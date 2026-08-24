// Saf dönüştürücü: Meta Insights JSON → CampaignResult girdisi (taslak).
// Prisma'sız ve fetch'siz — node --test ile tek başına koşar.
//
// Davranış kararları mevcut CSV parser'la (lib/results/import-csv.ts) birebir:
// - Erişim (reach) birden çok satırdan TOPLANMAZ (kişiler örtüşür) → null + uyarı.
// - Eksik metrikten hesap uydurulmaz: satın alma yoksa purchases/revenue null kalır,
//   ROAS türetilmez ("conversion tracking yok" notu düşülür).
// - Tek kampanya kuralı: farklı campaign_id'li satırlar tek sonuca toplanamaz.
// - Sayılar katı parse edilir (Meta sayısal alanları STRING döner); bozuk sayı → hata.
//
// Kaynak doğrulaması: docs/meta/SOURCES-C.md §1–§3 (retrieved 2026-08-24).

export type MetaActionStat = {
  action_type?: unknown;
  value?: unknown;
};

// Meta insights cevabındaki tek satır (data[i]) — alanlar SOURCES-C §1'de doğrulandı.
export type MetaInsightsRow = {
  spend?: unknown;
  impressions?: unknown;
  clicks?: unknown;
  inline_link_clicks?: unknown;
  reach?: unknown;
  actions?: unknown;
  action_values?: unknown;
  account_currency?: unknown;
  date_start?: unknown;
  date_stop?: unknown;
  campaign_id?: unknown;
  campaign_name?: unknown;
  attribution_setting?: unknown;
};

// addCampaignResult'ın kullandığı resultSchema alanlarıyla birebir hizalı taslak
// + kaynak/dürüstlük metadata'sı. Şema doğrulaması action katmanında yapılır
// (aynı zod şeması — lib/results/schema.ts).
export type MetaInsightsDraft = {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number | null;
  purchases: number | null;
  revenue: number | null;
  rowCount: number;
  campaignId: string | null;
  campaignName: string | null;
  currency: string | null;
  // Meta cevabındaki attribution_setting — geriye dönük değişim uyarısıyla UI'da gösterilir (§38)
  attributionSetting: string | null;
  clicksSource: string;
  // Sayımda kullanılan action_type (çift sayım önleme — SOURCES-C §3)
  purchaseActionType: string | null;
  // false → "conversion tracking yok" açıkça yazılır (CLAUDE.md §24)
  hasConversionData: boolean;
  warnings: string[];
};

export type MetaInsightsTransform =
  | { ok: true; draft: MetaInsightsDraft }
  | { ok: false; error: string };

// SOURCES-C §3: omni_* toplamları kanal-özel tiplerin üst kümesi — tipler arası
// TOPLAMA YAPILMAZ, öncelik sırasına göre TEK tip seçilir.
const PURCHASE_ACTION_PRIORITY = [
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_conversion.purchase",
] as const;

// --- katı sayı/tarih parse ---

// Meta sayısal alanları string döner ("1234.56"). Binlik ayraç YOKTUR;
// yalnız düz ondalık kabul edilir. Bozuk biçim null değil "invalid" sayılır.
function parseMetaNumber(
  raw: unknown,
): { kind: "absent" } | { kind: "invalid" } | { kind: "value"; value: number } {
  if (raw == null || raw === "") return { kind: "absent" };
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? { kind: "value", value: raw } : { kind: "invalid" };
  }
  if (typeof raw !== "string") return { kind: "invalid" };
  const s = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { kind: "invalid" };
  const n = Number(s);
  return Number.isFinite(n) ? { kind: "value", value: n } : { kind: "invalid" };
}

function parseMetaDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? m[0] : null;
}

function asString(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

// actions/action_values dizisinden belirli action_type'ın value'sunu okur.
// value = varsayılan attribution penceresi toplamı (SOURCES-C §3).
function actionValue(
  list: unknown,
  actionType: string,
): { kind: "absent" } | { kind: "invalid" } | { kind: "value"; value: number } {
  if (!Array.isArray(list)) return { kind: "absent" };
  const entry = (list as MetaActionStat[]).find(
    (a) => a && typeof a === "object" && a.action_type === actionType,
  );
  if (!entry) return { kind: "absent" };
  return parseMetaNumber(entry.value);
}

function presentActionTypes(list: unknown): Set<string> {
  const set = new Set<string>();
  if (!Array.isArray(list)) return set;
  for (const a of list as MetaActionStat[]) {
    if (a && typeof a === "object" && typeof a.action_type === "string") {
      set.add(a.action_type);
    }
  }
  return set;
}

// --- ana dönüştürücü ---

export function transformInsightsToResultDraft(
  rows: MetaInsightsRow[],
): MetaInsightsTransform {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      ok: false,
      error:
        "Meta bu dönem için veri döndürmedi. Kampanya seçilen aralıkta yayında olmamış olabilir; dönemi kontrol et.",
    };
  }

  const warnings: string[] = [];

  // Tek kampanya kuralı (CSV parser'daki kararla aynı)
  const campaignIds = new Set(
    rows.map((r) => asString(r.campaign_id)).filter((v): v is string => v != null),
  );
  if (campaignIds.size > 1) {
    return {
      ok: false,
      error: `Cevapta ${campaignIds.size} farklı kampanya var; tek sonuca toplanamaz. Senkron tek kampanya seviyesinde çalışmalı.`,
    };
  }

  let spend = 0;
  let spendSeen = false;
  let impressions = 0;
  let impressionsSeen = false;
  let clicks = 0;
  let clicksSeen = false;
  let usedInlineLinkClicks = false;
  let usedAllClicks = false;
  let reachSingle: number | null = null;
  let purchases = 0;
  let purchasesSeen = false;
  let revenue = 0;
  let revenueSeen = false;
  const dates: string[] = [];

  // Satın alma tipi TÜM satırların birleşimi üzerinden bir kez seçilir ki
  // satırlar arası tutarlı sayılsın (tipler arası toplama yasak).
  const allActionTypes = new Set<string>();
  for (const r of rows) {
    for (const t of presentActionTypes(r.actions)) allActionTypes.add(t);
  }
  const purchaseType =
    PURCHASE_ACTION_PRIORITY.find((t) => allActionTypes.has(t)) ?? null;
  if (purchaseType && purchaseType !== "omni_purchase") {
    warnings.push(
      `Satın alma sayımı için '${purchaseType}' kullanıldı (kanallar arası toplam 'omni_purchase' cevapta yoktu).`,
    );
  }

  for (const [i, r] of rows.entries()) {
    const rowLabel = rows.length > 1 ? ` (satır ${i + 1})` : "";

    const sp = parseMetaNumber(r.spend);
    if (sp.kind === "invalid") {
      return { ok: false, error: `Meta cevabındaki 'spend' değeri okunamadı${rowLabel}.` };
    }
    if (sp.kind === "value") {
      spend += sp.value;
      spendSeen = true;
    }

    const imp = parseMetaNumber(r.impressions);
    if (imp.kind === "invalid") {
      return { ok: false, error: `Meta cevabındaki 'impressions' değeri okunamadı${rowLabel}.` };
    }
    if (imp.kind === "value") {
      impressions += Math.round(imp.value);
      impressionsSeen = true;
    }

    // Tıklama: CSV parser'daki tercihle aynı — link tıklaması varsa o, yoksa tüm
    // tıklamalar (uyarıyla). inline_link_clicks = "clicks on links to select
    // destinations", clicks = tüm tıklamalar (SOURCES-C §1).
    const inline = parseMetaNumber(r.inline_link_clicks);
    if (inline.kind === "invalid") {
      return {
        ok: false,
        error: `Meta cevabındaki 'inline_link_clicks' değeri okunamadı${rowLabel}.`,
      };
    }
    if (inline.kind === "value") {
      clicks += Math.round(inline.value);
      clicksSeen = true;
      usedInlineLinkClicks = true;
    } else {
      const all = parseMetaNumber(r.clicks);
      if (all.kind === "invalid") {
        return { ok: false, error: `Meta cevabındaki 'clicks' değeri okunamadı${rowLabel}.` };
      }
      if (all.kind === "value") {
        clicks += Math.round(all.value);
        clicksSeen = true;
        usedAllClicks = true;
      }
    }

    const re = parseMetaNumber(r.reach);
    if (re.kind === "invalid") {
      return { ok: false, error: `Meta cevabındaki 'reach' değeri okunamadı${rowLabel}.` };
    }
    if (re.kind === "value" && rows.length === 1) {
      reachSingle = Math.round(re.value);
    }

    if (purchaseType) {
      const pv = actionValue(r.actions, purchaseType);
      if (pv.kind === "invalid") {
        return {
          ok: false,
          error: `Meta cevabındaki '${purchaseType}' aksiyon değeri okunamadı${rowLabel}.`,
        };
      }
      if (pv.kind === "value") {
        purchases += Math.round(pv.value);
        purchasesSeen = true;
      }
      const rv = actionValue(r.action_values, purchaseType);
      if (rv.kind === "invalid") {
        return {
          ok: false,
          error: `Meta cevabındaki '${purchaseType}' gelir değeri okunamadı${rowLabel}.`,
        };
      }
      if (rv.kind === "value") {
        revenue += rv.value;
        revenueSeen = true;
      }
    }

    const ds = parseMetaDate(r.date_start);
    const de = parseMetaDate(r.date_stop);
    if (ds) dates.push(ds);
    if (de) dates.push(de);
  }

  if (!spendSeen && !impressionsSeen && !clicksSeen) {
    return {
      ok: false,
      error: "Meta cevabından kullanılabilir sayısal veri okunamadı (spend/impressions/clicks yok).",
    };
  }
  if (dates.length === 0) {
    return {
      ok: false,
      error: "Meta cevabında dönem tarihleri (date_start/date_stop) yok; sonuç dönemsiz kaydedilemez.",
    };
  }
  if (spend <= 0) {
    // resultSchema harcamayı pozitif ister; sıfır harcamalı dönem dürüstçe reddedilir,
    // 0.01 gibi bir değer UYDURULMAZ.
    return {
      ok: false,
      error:
        "Meta bu dönem için 0 harcama döndürdü. Sonuç kaydı pozitif harcama gerektirir; kampanyanın harcadığı bir dönem seç.",
    };
  }

  if (usedAllClicks) {
    warnings.push(
      usedInlineLinkClicks
        ? "Bazı satırlarda bağlantı tıklaması yoktu; o satırlarda tüm tıklamalar (clicks) kullanıldı."
        : "Tıklama olarak 'tüm tıklamalar' (clicks) kullanıldı; bağlantı tıklaması (inline_link_clicks) cevapta yoktu. CTR olduğundan yüksek çıkabilir.",
    );
  }

  // Erişim: CSV parser kararıyla birebir — birden çok satırdan toplanmaz.
  let reach: number | null = null;
  if (rows.length === 1) {
    reach = reachSingle;
  } else {
    const anyReach = rows.some((r) => parseMetaNumber(r.reach).kind === "value");
    if (anyReach) {
      warnings.push(
        "Erişim birden çok satırdan toplanamaz (aynı kişiler örtüşür); boş bırakıldı. Dönemin gerçek erişimi için senkronu tek toplam satırla (time_increment=all_days) çalıştır.",
      );
    }
  }

  const hasConversionData = purchaseType != null && purchasesSeen;
  if (!hasConversionData) {
    warnings.push(
      "Meta cevabında satın alma dönüşümü yok — bu kampanyada conversion tracking görünmüyor. CPA/ROAS hesaplanmayacak; sayı uydurulmaz.",
    );
  } else if (!revenueSeen) {
    warnings.push(
      "Satın alma sayısı var ama gelir değeri (action_values) yok; ROAS hesaplanmayacak.",
    );
  }

  dates.sort();

  const first = rows[0];
  return {
    ok: true,
    draft: {
      periodStart: dates[0],
      periodEnd: dates[dates.length - 1],
      spend: Math.round(spend * 100) / 100,
      impressions,
      clicks,
      reach,
      purchases: hasConversionData ? purchases : null,
      revenue: hasConversionData && revenueSeen ? Math.round(revenue * 100) / 100 : null,
      rowCount: rows.length,
      campaignId: campaignIds.size === 1 ? [...campaignIds][0] : null,
      campaignName: asString(first.campaign_name),
      currency: asString(first.account_currency),
      attributionSetting: asString(first.attribution_setting),
      clicksSource: usedAllClicks
        ? "Tüm tıklamalar (clicks)"
        : "Bağlantı tıklamaları (inline_link_clicks)",
      purchaseActionType: hasConversionData ? purchaseType : null,
      hasConversionData,
      warnings,
    },
  };
}
