// Ads Manager Kurulum Kiti v2 — deterministik builder (AI YOK).
// Girdi: COMPLETED plan + yalnız APPROVED creative'ler + marka. Çıktı: PublishKit.kit.
// Kural: planda olmayan değer UYDURULMAZ → value "" + gaps. (docs/AGENT-B.md §3)
// Bu dosya saf fonksiyondur: server-only / Prisma importu yok (node --test ile koşar).

import type {
  BuildKitInput,
  BuilderCreative,
  Kit,
  KitAd,
  KitAdset,
  KitAsset,
  KitConfidence,
  KitField,
  KitInputs,
  KitRatio,
  KitSection,
  KitStep,
  PlanResultShape,
} from "./types";
import {
  COPY_LIMITS,
  CTA_BUTTONS,
  FIELD_DEFS,
  GENDER_OPTIONS,
  IMAGE_SPECS,
  META_FIELDS_DOC,
  META_FIELDS_RETRIEVED_AT,
  OBJECTIVES,
  PLACEMENT_MODES,
  SECTION_TITLES,
  SPECIAL_AD_CATEGORIES,
  type FieldDef,
} from "./meta-fields";

export const KIT_DISCLAIMER =
  "Bu kit öneridir; son ayarları Ads Manager'da sen belirlersin. Bütçe ve harcama tamamen senin kontrolünde.";

export const ALL_RATIOS: KitRatio[] = ["1x1", "4x5", "9x16"];

// ---------- yardımcılar ----------

const TR_FOLD: Record<string, string> = {
  ı: "i",
  İ: "i",
  ş: "s",
  Ş: "s",
  ğ: "g",
  Ğ: "g",
  ç: "c",
  Ç: "c",
  ö: "o",
  Ö: "o",
  ü: "u",
  Ü: "u",
};

// Türkçe karakterleri ASCII'ye indirip küçültür; eşleştirme için.
export function normalizeText(s: string): string {
  return s
    .replace(/[ıİşŞğĞçÇöÖüÜ]/g, (ch) => TR_FOLD[ch] ?? ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Dosya adı için güvenli slug (ASCII; Content-Disposition'da Latin-1 dışı karakter olmaz).
export function slugify(s: string, max = 48): string {
  const base = normalizeText(s).replace(/\s+/g, "-");
  return (base || "reklam").slice(0, max).replace(/-+$/, "");
}

// TR etiket varsa onu, yoksa EN'i döndürür (tip: literal daraltmasını önlemek için geniş)
function trLabel(o: { labelEn: string; labelTr?: string }): string {
  return o.labelTr || o.labelEn;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

function confidence(v: unknown): KitConfidence | undefined {
  return v === "low" || v === "medium" || v === "high" ? v : undefined;
}

export function readPlanResult(result: unknown): PlanResultShape {
  return result && typeof result === "object"
    ? (result as PlanResultShape)
    : {};
}

function def(id: string): FieldDef {
  const d = FIELD_DEFS[id];
  if (!d) throw new Error(`FIELD_DEFS eksik: ${id}`);
  return d;
}

function field(
  id: string,
  defId: string,
  value: string,
  source: KitField["source"],
  extra: Partial<KitField> = {},
): KitField {
  const d = def(defId);
  return {
    id,
    label: d.label,
    adsManagerPath: d.path,
    value,
    source,
    sourceUrl: d.sourceUrl,
    ...extra,
  };
}

// ---------- eşleştirmeler (deterministik, liste dokümandan) ----------

export function matchObjective(
  key: string | undefined,
  recommended: string | undefined,
): (typeof OBJECTIVES)[number] | null {
  const k = normalizeText(key ?? "");
  if (k) {
    const byKey = OBJECTIVES.find(
      (o) => o.key === k || normalizeText(o.apiEnum) === k,
    );
    if (byKey) return byKey;
  }
  const r = normalizeText(recommended ?? "");
  if (!r) return null;
  // Serbest metinde API enum veya etiket geçiyorsa yakala ("SALES (Satışlar)")
  return (
    OBJECTIVES.find((o) =>
      o.matchers.some((m) => new RegExp(`\\b${m}\\b`).test(r)),
    ) ?? null
  );
}

export type CtaMatch = {
  apiEnum: string | null;
  label: string | null;
  match: "exact" | "approximate" | "none";
};

export function matchCta(raw: string): CtaMatch {
  const n = normalizeText(raw);
  if (!n) return { apiEnum: null, label: null, match: "none" };
  for (const c of CTA_BUTTONS) {
    const labels = [c.labelEn, c.labelTr ?? ""].map(normalizeText).filter(Boolean);
    if (labels.includes(n) || normalizeText(c.apiEnum) === n) {
      return { apiEnum: c.apiEnum, label: trLabel(c), match: "exact" };
    }
  }
  for (const c of CTA_BUTTONS) {
    if (c.synonyms.some((s) => normalizeText(s) === n)) {
      return { apiEnum: c.apiEnum, label: trLabel(c), match: "approximate" };
    }
  }
  return { apiEnum: null, label: null, match: "none" };
}

function matchGender(raw: string): string {
  const n = normalizeText(raw);
  if (!n) return "";
  const hit = GENDER_OPTIONS.find((g) =>
    g.matchers.some((m) => new RegExp(`\\b${m}\\b`).test(n)),
  );
  return hit ? hit.label : raw.trim();
}

function parseAge(
  ageMin: unknown,
  ageMax: unknown,
  age: string,
): { value: string; parsed: boolean } {
  const min = typeof ageMin === "number" ? ageMin : null;
  const max = typeof ageMax === "number" ? ageMax : null;
  if (min != null && max != null) return { value: `${min}-${max}`, parsed: true };
  const m = age.match(/(\d{2})\s*[-–]\s*(\d{2}\+?)/);
  if (m) return { value: `${m[1]}-${m[2]}`, parsed: true };
  return { value: age.trim(), parsed: false };
}

// ---------- reklam seti / reklam eşlemesi ----------

function toKitAd(c: BuilderCreative): KitAd {
  const cta = matchCta(c.cta);
  return {
    creativeId: c.id,
    headline: c.headline,
    primaryText: c.primaryText,
    description: c.description ?? null,
    cta: c.cta,
    ctaButton: cta.apiEnum,
    ctaMatch: cta.match,
    imageIds: c.images
      .filter((i) => i.status === "COMPLETED" && i.hasData)
      .map((i) => i.id),
  };
}

export function buildAdsets(
  result: PlanResultShape,
  approved: BuilderCreative[],
  campaignName: string,
  gaps: string[],
): KitAdset[] {
  const structure = Array.isArray(result.structure) ? result.structure : [];
  const byHeadline = new Map(
    approved.map((c) => [normalizeText(c.headline), c] as const),
  );
  const used = new Set<string>();
  const adsets: KitAdset[] = [];

  for (const [i, s] of structure.entries()) {
    const ads: KitAd[] = [];
    for (const h of strList(s.creative_headlines)) {
      const c = byHeadline.get(normalizeText(h));
      if (!c) {
        gaps.push(
          `"${h}" başlıklı creative onaylı değil ya da bulunamadı; kit dışında bırakıldı (reklam seti: ${str(s.adset_name) || i + 1}).`,
        );
        continue;
      }
      if (used.has(c.id)) continue; // aynı creative iki sette: ilkinde kalır
      used.add(c.id);
      ads.push(toKitAd(c));
    }
    adsets.push({
      name: str(s.adset_name) || `${campaignName} - Reklam seti ${i + 1}`,
      purpose: str(s.purpose),
      testVariable: str(s.test_variable) || null,
      ads,
    });
  }

  const leftover = approved.filter((c) => !used.has(c.id));
  if (adsets.length === 0) {
    adsets.push({
      name: `${campaignName} - Reklam seti 1`,
      purpose: "",
      testVariable: null,
      ads: leftover.map(toKitAd),
    });
    gaps.push(
      "Plan reklam seti yapısı içermiyor; tüm onaylı creative'ler tek reklam setinde listelendi. Reklam seti adını ve amacını sen belirle.",
    );
  } else if (leftover.length > 0) {
    adsets[0].ads.push(...leftover.map(toKitAd));
    gaps.push(
      `Planın yapısında geçmeyen ${leftover.length} onaylı creative ilk reklam setine eklendi: ${leftover.map((c) => `"${c.headline}"`).join(", ")}.`,
    );
  }
  // Boş reklam setleri (tüm creative'leri onaysız) uyarı olarak kalır
  for (const a of adsets) {
    if (a.ads.length === 0) {
      gaps.push(`"${a.name}" reklam setinde onaylı creative kalmadı.`);
    }
  }
  return adsets;
}

// ---------- bölümler ----------

function campaignSection(
  result: PlanResultShape,
  campaignName: string,
  budget: Kit["budget"],
  inputs: KitInputs,
  gaps: string[],
): KitSection {
  const fields: KitField[] = [];
  const steps: KitStep[] = [];

  // Hedef (objective)
  const obj = matchObjective(result.objective?.key, result.objective?.recommended);
  const objRaw = str(result.objective?.recommended);
  if (obj) {
    fields.push(
      field("campaign.objective", "campaign.objective", trLabel(obj), "plan", {
        why: str(result.objective?.reason) || undefined,
        confidence: confidence(result.objective?.confidence),
        alternative: str(result.objective?.alternative) || undefined,
        note: `Ads Manager: ${obj.labelEn} · Marketing API: ${obj.apiEnum}`,
      }),
    );
  } else {
    fields.push(
      field("campaign.objective", "campaign.objective", objRaw, "plan", {
        why: str(result.objective?.reason) || undefined,
        confidence: confidence(result.objective?.confidence),
        alternative: str(result.objective?.alternative) || undefined,
        note: objRaw
          ? "Plan metni Ads Manager hedef listesine eşleştirilemedi; listeden elle seç."
          : undefined,
      }),
    );
    gaps.push(
      objRaw
        ? `Kampanya hedefi "${objRaw}" Ads Manager'ın 6 hedefinden birine eşleştirilemedi; elle seç.`
        : "Plan kampanya hedefi (objective) içermiyor; Ads Manager'da elle seç.",
    );
  }
  steps.push({
    id: "campaign.objective",
    text: `Hedef seç: ${fields[0].value || "(planda yok)"}`,
  });

  // Kampanya adı — kullanıcı Ads Manager'da farklı ad girdiyse o geçerli
  const nameValue = str(inputs.adsManagerCampaignName) || campaignName;
  fields.push(
    field("campaign.name", "campaign.name", nameValue, str(inputs.adsManagerCampaignName) ? "user_input" : "plan", {
      inputKey: "adsManagerCampaignName",
    }),
  );
  steps.push({ id: "campaign.name", text: `Kampanya adı: ${nameValue}` });

  // Özel reklam kategorisi
  const sac = str(result.special_ad_category?.recommended).toUpperCase();
  const sacDef = SPECIAL_AD_CATEGORIES.find((s) => s.apiEnum === sac);
  fields.push(
    field("campaign.special_ad_category", "campaign.special_ad_category", sacDef ? trLabel(sacDef) : "", "plan", {
      why: str(result.special_ad_category?.reason) || undefined,
      note: sacDef
        ? `Marketing API: ${sacDef.apiEnum}. İşletmen kredi/istihdam/konut/sosyal konular/finansal ürünler kapsamındaysa ilgili kategoriyi seçmek zorunludur — doğrula.`
        : "Planda yok: işletmen özel kategori (kredi, istihdam, konut, sosyal konular, finansal ürünler) kapsamındaysa seç; değilse boş bırak.",
    }),
  );
  if (!sacDef) {
    gaps.push(
      "Özel reklam kategorisi planda belirtilmemiş; işletmen kapsam dışındaysa boş bırak, kapsamdaysa ilgili kategoriyi seç.",
    );
  }
  steps.push({
    id: "campaign.special_ad_category",
    text: `Özel reklam kategorisi: ${sacDef ? trLabel(sacDef) : "doğrula (planda yok)"}`,
  });

  // Bütçe düzeyi (Advantage+ kampanya bütçesi)
  const level = normalizeText(str(result.budget_plan?.level));
  const budgetText = `${budget.amount} ${budget.currency} (${budget.type === "DAILY" ? "günlük" : "toplam"})${budget.durationDays ? ` · ${budget.durationDays} gün` : ""}`;
  if (level === "campaign") {
    fields.push(
      field("campaign.budget", "campaign.budget", budgetText, "plan", {
        note: "Advantage+ kampanya bütçesi AÇIK: bütçe kampanya düzeyinde girilir, reklam setlerine Meta dağıtır.",
      }),
    );
  } else if (level === "adset") {
    fields.push(
      field("campaign.budget", "campaign.budget", "", "plan", {
        note: `Advantage+ kampanya bütçesi KAPALI: bütçe (${budgetText}) reklam seti düzeyinde girilir.`,
      }),
    );
  } else {
    fields.push(
      field("campaign.budget", "campaign.budget", budgetText, "plan", {
        note: "Plan bütçe düzeyini (kampanya / reklam seti) belirtmiyor; bütçe senaryolarına göre sen seç.",
      }),
    );
    gaps.push(
      "Bütçe düzeyi (Advantage+ kampanya bütçesi açık mı, reklam seti bütçesi mi) planda belirtilmemiş; bütçe senaryolarına bakarak seç.",
    );
  }
  steps.push({
    id: "campaign.budget",
    text:
      level === "adset"
        ? "Advantage+ kampanya bütçesini kapalı bırak; bütçeyi reklam setinde gir."
        : `Kampanya bütçesi: ${budgetText}`,
  });

  return { id: "campaign", title: SECTION_TITLES.campaign, fields, steps };
}

function adsetSection(
  result: PlanResultShape,
  adsets: KitAdset[],
  budget: Kit["budget"],
  brand: BuildKitInput["brand"],
  inputs: KitInputs,
  gaps: string[],
): KitSection {
  const fields: KitField[] = [];
  const steps: KitStep[] = [];
  const oe = result.optimization_event ?? {};
  const sug = result.audience?.suggestion ?? {};
  const pl = result.placements ?? {};

  // Dönüşüm konumu / performans hedefi / pixel-event — tüm reklam setleri için ortak
  const convLoc = str(oe.conversion_location);
  const perfGoal = str(oe.performance_goal) || str(oe.recommended);
  const eventName = str(inputs.conversionEvent) || str(oe.event_name);

  const locations = strList(sug.locations);
  const planLocation = locations.length ? locations.join(", ") : str(sug.location);
  // Planda konum yoksa markanın seçili hedef pazarı (kullanıcı ayarı) kullanılır
  const locationValue = planLocation || (brand.targetMarket ?? "");
  const locationSource: KitField["source"] = planLocation ? "plan" : "brand";
  const age = parseAge(sug.age_min, sug.age_max, str(sug.age));
  const gender = matchGender(str(sug.gender));
  const detailed = strList(sug.detailed_targeting);
  const detailedValue = detailed.length
    ? detailed.join(", ")
    : str(sug.interests_behaviors);
  const aPlusAudience =
    typeof sug.advantage_plus_audience === "boolean"
      ? sug.advantage_plus_audience
        ? "Açık"
        : "Kapalı"
      : "";

  const mode = normalizeText(str(pl.mode));
  const plRaw = str(pl.recommended);
  const plMode =
    mode === "advantage plus" || mode === "advantage_plus" || mode === "advantage"
      ? PLACEMENT_MODES.advantage_plus
      : mode === "manual"
        ? PLACEMENT_MODES.manual
        : /advantage/.test(normalizeText(plRaw))
          ? PLACEMENT_MODES.advantage_plus
          : null;
  const plList = strList(pl.list);

  adsets.forEach((a, i) => {
    const p = `adset.${i}`;
    fields.push(field(`${p}.name`, "adset.name", a.name, "plan", { why: a.purpose || undefined }));
    steps.push({ id: `${p}.name`, text: `Reklam seti ${i + 1} adı: ${a.name}` });

    fields.push(
      field(`${p}.conversion_location`, "adset.conversion_location", convLoc, "plan", {
        note: convLoc ? undefined : "Planda yok (eski plan şekli); hedefe göre seç — web sitesi satışı için genelde 'Web sitesi'.",
      }),
    );
    fields.push(
      field(`${p}.performance_goal`, "adset.performance_goal", perfGoal, "plan", {
        why: str(oe.reason) || undefined,
        note: str(oe.pixel_condition) ? `Pixel koşulu: ${str(oe.pixel_condition)}` : undefined,
      }),
    );
    fields.push(
      field(`${p}.pixel`, "adset.pixel", str(inputs.pixelDataset), "user_input", {
        inputKey: "pixelDataset",
        note: "Ads Manager'da listelenen pixel/veri seti adı; yoksa Events Manager'da oluştur.",
      }),
    );
    fields.push(
      field(`${p}.conversion_event`, "adset.conversion_event", eventName, str(inputs.conversionEvent) ? "user_input" : "plan", {
        inputKey: "conversionEvent",
        note: eventName ? undefined : "Planda standart event adı yok; pixel'inde tetiklenen event'i seç.",
      }),
    );
    steps.push({
      id: `${p}.conversion`,
      text: `Dönüşüm: konum ${convLoc || "(seç)"} · performans hedefi ${perfGoal || "(seç)"} · pixel ${str(inputs.pixelDataset) || "(seç)"} · event ${eventName || "(seç)"}`,
    });

    // Bütçe & zamanlama (reklam seti düzeyi)
    const levelAdset = normalizeText(str(result.budget_plan?.level)) === "adset";
    const budgetText = `${budget.amount} ${budget.currency} (${budget.type === "DAILY" ? "günlük" : "toplam"})`;
    fields.push(
      field(`${p}.budget_schedule`, "adset.budget_schedule", levelAdset ? budgetText : "", "plan", {
        note: levelAdset
          ? adsets.length > 1
            ? "Birden çok reklam seti var: bütçeyi senaryo notlarına göre böl (toplam kullanıcının bütçesini aşmaz)."
            : undefined
          : "Advantage+ kampanya bütçesi kullanılıyorsa burada bütçe girilmez; yalnız zamanlamayı ayarla.",
      }),
    );
    fields.push(
      field(`${p}.schedule`, "adset.schedule", budget.durationDays ? `Başlangıçtan itibaren ${budget.durationDays} gün` : "", "plan", {
        note: budget.durationDays ? "Bitiş tarihini başlangıç + süre olarak gir." : "Planda süre yok; bitiş tarihini sen belirle ya da açık bırak.",
      }),
    );
    steps.push({
      id: `${p}.budget_schedule`,
      text: `Bütçe & zamanlama: ${levelAdset ? budgetText : "kampanya düzeyinde"}${budget.durationDays ? ` · ${budget.durationDays} gün` : ""}`,
    });

    // Kitle
    fields.push(
      field(`${p}.locations`, "adset.locations", locationValue, locationSource, {
        note: planLocation ? undefined : locationValue ? "Planda konum yok; marka ayarındaki hedef pazar (ülke kodu) kondu." : undefined,
      }),
    );
    fields.push(
      field(`${p}.age`, "adset.age", age.value, "plan", {
        note: age.value && !age.parsed ? "Yaş aralığı sayı olarak ayrıştırılamadı; metni Ads Manager'a uyarlayarak gir." : undefined,
      }),
    );
    fields.push(field(`${p}.gender`, "adset.gender", gender, "plan"));
    fields.push(
      field(`${p}.detailed_targeting`, "adset.detailed_targeting", detailedValue, "plan", {
        note: "Ads Manager arama kutusunda birebir eşleşme olmayabilir; en yakın ilgi alanlarını seç.",
      }),
    );
    fields.push(
      field(`${p}.advantage_plus_audience`, "adset.advantage_plus_audience", aPlusAudience, "plan", {
        why: str(sug.advantage_plus_note) || undefined,
      }),
    );
    steps.push({
      id: `${p}.audience`,
      text: `Kitle: ${[locationValue && `konum ${locationValue}`, age.value && `yaş ${age.value}`, gender && `cinsiyet ${gender}`].filter(Boolean).join(" · ") || "(planda yok)"}`,
    });

    // Yerleşimler
    fields.push(
      field(`${p}.placements`, "adset.placements", plMode ? trLabel(plMode) : plRaw, "plan", {
        why: str(pl.reason) || undefined,
        confidence: confidence(pl.confidence),
        note: plMode
          ? plMode === PLACEMENT_MODES.manual && plList.length
            ? `Seçilecek yerleşimler: ${plList.join(", ")}`
            : undefined
          : plRaw
            ? "Plan metni yerleşim moduna eşleştirilemedi; Advantage+ / manuel seçimini sen yap."
            : undefined,
      }),
    );
    steps.push({
      id: `${p}.placements`,
      text: `Yerleşimler: ${plMode ? trLabel(plMode) : plRaw || "(seç)"}`,
    });
  });

  if (!convLoc) gaps.push("Dönüşüm konumu planda yok (eski plan şekli); reklam setinde elle seç.");
  if (!perfGoal) gaps.push("Performans hedefi planda yok; reklam setinde elle seç.");
  if (!str(inputs.pixelDataset)) gaps.push("Pixel / veri seti adı: Ads Manager'da hangi pixel'i kullanacağını gir.");
  if (!eventName) gaps.push("Dönüşüm event'i planda yok; pixel'inde tetiklenen event'i seç.");
  if (!locationValue) gaps.push("Konum planda ve marka ayarında yok; hedef pazara göre gir.");
  if (!age.value) gaps.push("Yaş aralığı planda yok.");
  if (!gender) gaps.push("Cinsiyet planda yok.");
  if (!plMode && !plRaw) gaps.push("Yerleşim önerisi planda yok; Advantage+ yerleşimleri varsayılanını değerlendir.");

  return { id: "adset", title: SECTION_TITLES.adset, fields, steps };
}

function adSection(
  adsets: KitAdset[],
  brand: BuildKitInput["brand"],
  inputs: KitInputs,
  gaps: string[],
): KitSection {
  const fields: KitField[] = [];
  const steps: KitStep[] = [];

  const page = str(inputs.facebookPage);
  const ig = str(inputs.instagramAccount);
  const url = str(inputs.destinationUrl) || (brand.website ?? "");

  fields.push(
    field("ad.identity.page", "ad.identity.page", page, "user_input", { inputKey: "facebookPage" }),
  );
  fields.push(
    field("ad.identity.instagram", "ad.identity.instagram", ig, "user_input", {
      inputKey: "instagramAccount",
      note: "Instagram hesabı bağlı değilse Sayfa adına gösterilir.",
    }),
  );
  fields.push(
    field("ad.destination_url", "ad.destination_url", url, str(inputs.destinationUrl) ? "user_input" : url ? "brand" : "user_input", {
      inputKey: "destinationUrl",
      note: !str(inputs.destinationUrl) && url ? "Marka web sitesi varsayılan olarak kondu; ürün/kampanya sayfasına değiştirebilirsin." : undefined,
    }),
  );
  if (!page) gaps.push("Facebook Sayfası: reklamın kimliği olacak Sayfa adını gir.");
  if (!ig) gaps.push("Instagram hesabı: bağlıysa adını gir; yoksa boş bırak.");
  if (!url) gaps.push("Hedef URL: reklamın yönlendireceği sayfa.");

  steps.push({ id: "ad.identity", text: `Kimlik: Sayfa ${page || "(gir)"}${ig ? ` · Instagram ${ig}` : ""}` });

  let n = 0;
  adsets.forEach((a, ai) => {
    a.ads.forEach((ad) => {
      n += 1;
      const p = `ad.${ad.creativeId}`;
      const pt = COPY_LIMITS.primaryText;
      const hl = COPY_LIMITS.headline;
      const ds = COPY_LIMITS.description;
      fields.push(
        field(`${p}.name`, "ad.name", `${a.name} - ${slugify(ad.headline, 40)}`, "creative", {
          note: `Reklam seti ${ai + 1} içindeki reklam ${n}`,
        }),
      );
      fields.push(field(`${p}.format`, "ad.format", "Tek görsel veya video", "creative", {
        note: ad.imageIds.length ? `${ad.imageIds.length} görsel hazır (1:1 / 4:5 / 9:16 indirilebilir).` : "Bu creative için üretilmiş görsel yok; Creative Studio'da üret ya da kendi görselini yükle.",
      }));
      fields.push(
        field(`${p}.primary_text`, "ad.primary_text", ad.primaryText, "creative", {
          charLimit: pt.limit,
          charLimitNote: pt.note,
          sourceUrl: pt.sourceUrl,
        }),
      );
      fields.push(
        field(`${p}.headline`, "ad.headline", ad.headline, "creative", {
          charLimit: hl.limit,
          charLimitNote: hl.note,
          sourceUrl: hl.sourceUrl,
        }),
      );
      fields.push(
        field(`${p}.description`, "ad.description", ad.description ?? "", "creative", {
          charLimit: ds.limit,
          charLimitNote: ds.note,
          sourceUrl: ds.sourceUrl,
          note: ad.description ? undefined : "Creative'de açıklama yok; boş bırakılabilir.",
        }),
      );
      const ctaDef = CTA_BUTTONS.find((c) => c.apiEnum === ad.ctaButton);
      fields.push(
        field(`${p}.cta`, "ad.cta", ctaDef ? trLabel(ctaDef) : ad.cta, "creative", {
          note:
            ad.ctaMatch === "exact"
              ? `Marketing API: ${ad.ctaButton}`
              : ad.ctaMatch === "approximate"
                ? `Creative CTA'sı "${ad.cta}" için en yakın buton: ${ctaDef?.labelEn} (${ad.ctaButton}) — doğrula.`
                : `"${ad.cta}" Meta CTA buton listesiyle eşleştirilemedi; listeden elle seç.`,
        }),
      );
      if (ad.ctaMatch === "none") {
        gaps.push(`CTA "${ad.cta}" (${ad.headline}) Meta buton listesine eşleştirilemedi; Ads Manager'da listeden seç.`);
      }
      if (ad.imageIds.length === 0) {
        gaps.push(`Görsel yok: "${ad.headline}" — Creative Studio'da üret ya da kendi görselini yükle.`);
      }
      steps.push({ id: `${p}.create`, text: `Reklam ${n} (${a.name}): görsel yükle, metinleri yapıştır, CTA ${ctaDef ? trLabel(ctaDef) : ad.cta}, URL ${url || "(gir)"}` });
    });
  });

  fields.push(
    field("ad.tracking", "ad.tracking", str(inputs.pixelDataset), "user_input", {
      inputKey: "pixelDataset",
      note: "Web sitesi event'leri için reklam setinde seçtiğin pixel burada da işaretli olmalı.",
    }),
  );
  steps.push({ id: "ad.tracking", text: `İzleme: pixel ${str(inputs.pixelDataset) || "(seç)"}` });
  steps.push({ id: "ad.review", text: "Önizlemeyi kontrol et; bütçe ve tarihleri son kez doğrula; Yayınla." });

  return { id: "ad", title: SECTION_TITLES.ad, fields, steps };
}

// ---------- ana fonksiyon ----------

export function buildKit(input: BuildKitInput): Kit {
  const { plan, brand } = input;
  if (plan.status !== "COMPLETED") {
    throw new Error("Kit yalnız COMPLETED plandan üretilir.");
  }
  const result = readPlanResult(plan.result);
  const approved = input.creatives.filter((c) => c.approval === "APPROVED");
  if (approved.length === 0) {
    throw new Error("Kit için onaylı creative gerekli.");
  }
  const inputs: KitInputs = { ...(input.inputs ?? {}) };
  const gaps: string[] = [];
  const now = input.now ?? new Date();

  const campaignName = str(result.campaign_name) || `${brand.name} - ${plan.goal}`;
  if (!str(result.campaign_name)) {
    gaps.push("Plan kampanya adı içermiyor; marka + hedef ile türetildi, değiştirebilirsin.");
  }

  const budget: Kit["budget"] = {
    type: plan.budgetType,
    amount: plan.budgetAmount,
    currency: plan.currency,
    durationDays: plan.durationDays,
    scenarios: result.budget_plan?.scenarios ?? null,
  };

  const adsets = buildAdsets(result, approved, campaignName, gaps);

  const sections: KitSection[] = [
    campaignSection(result, campaignName, budget, inputs, gaps),
    adsetSection(result, adsets, budget, brand, inputs, gaps),
    adSection(adsets, brand, inputs, gaps),
  ];

  const assets: KitAsset[] = [];
  for (const a of adsets) {
    for (const ad of a.ads) {
      for (const imageId of ad.imageIds) {
        assets.push({ creativeImageId: imageId, ratios: [...ALL_RATIOS] });
      }
    }
  }

  for (const g of strList(result.data_gaps)) gaps.push(`Plan notu: ${g}`);

  return {
    version: 1,
    generatedAt: now.toISOString(),
    disclaimer: KIT_DISCLAIMER,
    sections,
    adsets,
    budget,
    assets,
    gaps: Array.from(new Set(gaps)),
    inputs,
    meta: { fieldsDoc: META_FIELDS_DOC, fieldsRetrievedAt: META_FIELDS_RETRIEVED_AT },
  };
}

// Kullanıcı girdileri değişince kit yeniden üretilir (deterministik) — plan/creative aynı.
export function applyKitInputs(base: BuildKitInput, inputs: KitInputs): Kit {
  return buildKit({ ...base, inputs });
}

export function imageSpec(ratio: KitRatio) {
  return IMAGE_SPECS[ratio];
}
