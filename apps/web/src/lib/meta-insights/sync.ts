// C1 — Insights senkronu (AGENT-C.md §3).
// Meta'dan kampanya performansını çeker, MEVCUT doğrulama yolundan geçirip
// CampaignResult'a yazar (source=META_API). Paralel model yok; kapılar aynen geçerli.
// Otomatik/zamanlanmış senkron YOK — yalnız kullanıcı tetikler.
// Uç doğrulaması: docs/meta/SOURCES-C.md §1–§3 (retrieved 2026-08-24).

import "server-only";

import { prisma } from "@adscore/db";
import { requireBrandBinding, MetaApiError, MetaBlockedError } from "@/lib/meta/client";
import { resultSchema } from "@/lib/results/schema";
import {
  transformInsightsToResultDraft,
  type MetaInsightsRow,
} from "@/lib/meta-insights/transform";

// SOURCES-C §1: türetilmiş metrikler (ctr/cpc/roas) İSTENMEZ — koddan hesaplanır.
export const INSIGHTS_FIELDS = [
  "spend",
  "impressions",
  "clicks",
  "inline_link_clicks",
  "reach",
  "actions",
  "action_values",
  "account_currency",
  "date_start",
  "date_stop",
  "campaign_id",
  "campaign_name",
  "attribution_setting",
].join(",");

export type SyncOutcome =
  | { kind: "ok"; resultId: string; warnings: string[]; updated: boolean }
  | { kind: "error"; message: string }
  | { kind: "blocked"; message: string };

// Sonuç kartında görünecek not (§38 tazelik + attribution kaydı). resultSchema
// notes ≤500 karakter ister — taşarsa kırpılır.
function buildSyncNote(input: {
  attributionSetting: string | null;
  purchaseActionType: string | null;
  hasConversionData: boolean;
  clicksSource: string;
}): string {
  const now = new Date();
  const stamp = `${now.toLocaleDateString("tr-TR")} ${now
    .getHours()
    .toString()
    .padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const parts = [
    `Meta API senkronu · çekildi: ${stamp}`,
    `attribution: ${input.attributionSetting ?? "cevapta belirtilmedi"} (dönüşümler geriye dönük değişebilir)`,
    input.hasConversionData
      ? `satın alma sayımı: ${input.purchaseActionType}`
      : "conversion tracking yok — satın alma/gelir verisi gelmedi",
    `tıklama: ${input.clicksSource}`,
  ];
  return parts.join(" · ").slice(0, 500);
}

/** Tek kampanya planı için insights çeker ve CampaignResult'a idempotent yazar.
 *  Aynı dönem tekrar çekilirse yeni satır AÇILMAZ, mevcut satır güncellenir
 *  (@@unique [planId, periodStart, periodEnd, source]). */
export async function runInsightSync(input: {
  planId: string;
  brandId: string;
  metaCampaignId: string;
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
}): Promise<SyncOutcome> {
  let binding: Awaited<ReturnType<typeof requireBrandBinding>>;
  try {
    binding = await requireBrandBinding(input.brandId);
  } catch (e) {
    if (e instanceof MetaBlockedError) {
      return { kind: "blocked", message: e.userMessage };
    }
    // İstemci beklenmedik şekilde kurulamadıysa da dürüst kapı (mock/fallback yok):
    return {
      kind: "blocked",
      message:
        "Meta bağlantısı hazır değil. Ayarlar'dan Meta hesabını bağla; bağlantı yokken sonuçları elle veya CSV ile girebilirsin.",
    };
  }

  const sync = await prisma.metaInsightSync.create({
    data: {
      brandId: input.brandId,
      planId: input.planId,
      adAccountId: binding.adAccountId,
      since: new Date(`${input.since}T00:00:00.000Z`),
      until: new Date(`${input.until}T00:00:00.000Z`),
      status: "RUNNING",
    },
  });

  const fail = async (message: string): Promise<SyncOutcome> => {
    await prisma.metaInsightSync.update({
      where: { id: sync.id },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    return { kind: "error", message };
  };

  let response: { data?: unknown };
  try {
    // time_increment GÖNDERİLMEZ (varsayılan all_days → tek toplam satır) ki
    // reach dönemin gerçek tekil erişimi olsun (SOURCES-C §1).
    response = await binding.client.get<{ data?: unknown }>(
      `${input.metaCampaignId}/insights`,
      {
        level: "campaign",
        fields: INSIGHTS_FIELDS,
        time_range: JSON.stringify({ since: input.since, until: input.until }),
      },
      { brandId: input.brandId },
    );
  } catch (e) {
    if (e instanceof MetaBlockedError) {
      await prisma.metaInsightSync.update({
        where: { id: sync.id },
        data: { status: "FAILED", error: e.userMessage, finishedAt: new Date() },
      });
      return { kind: "blocked", message: e.userMessage };
    }
    if (e instanceof MetaApiError) return fail(e.userMessage);
    return fail(
      "Meta çağrısı beklenmedik şekilde başarısız oldu. Tekrar dene; sürerse Ayarlar'dan bağlantıyı kontrol et.",
    );
  }

  // Ham cevap açıklanabilirlik için saklanır; sayılar HER ZAMAN koddan türetilir.
  await prisma.metaInsightSync.update({
    where: { id: sync.id },
    data: { raw: JSON.parse(JSON.stringify(response)) },
  });

  const rows = Array.isArray(response?.data) ? (response.data as MetaInsightsRow[]) : [];
  const transformed = transformInsightsToResultDraft(rows);
  if (!transformed.ok) return fail(transformed.error);
  const draft = transformed.draft;

  if (draft.campaignId && draft.campaignId !== input.metaCampaignId) {
    return fail(
      `Meta cevabındaki kampanya (${draft.campaignId}) beklenen kampanya (${input.metaCampaignId}) değil; kayıt yapılmadı.`,
    );
  }

  const note = buildSyncNote(draft);

  // AYNI zod şeması — elle giriş ve CSV ile birebir aynı doğrulama yolu
  // (lib/results/schema.ts). Doğrulama bypass edilmez.
  const parsed = resultSchema.safeParse({
    periodStart: draft.periodStart,
    periodEnd: draft.periodEnd,
    spend: draft.spend,
    impressions: draft.impressions,
    clicks: draft.clicks,
    reach: draft.reach ?? undefined,
    purchases: draft.purchases ?? undefined,
    revenue: draft.revenue ?? undefined,
    notes: note,
  });
  if (!parsed.success) {
    return fail(
      `Meta verisi sonuç doğrulamasından geçemedi: ${parsed.error.issues[0]?.message ?? "bilinmeyen hata"}`,
    );
  }

  // İdempotent yazım: aynı dönem + kaynak için tek satır.
  const where = {
    planId_periodStart_periodEnd_source: {
      planId: input.planId,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      source: "META_API" as const,
    },
  };
  const existing = await prisma.campaignResult.findUnique({ where });
  const values = {
    spend: parsed.data.spend,
    impressions: parsed.data.impressions,
    clicks: parsed.data.clicks,
    reach: parsed.data.reach ?? null,
    purchases: parsed.data.purchases ?? null,
    revenue: parsed.data.revenue ?? null,
    notes: parsed.data.notes ?? null,
    externalRef: input.metaCampaignId,
  };
  const result = existing
    ? await prisma.campaignResult.update({
        where,
        data: {
          ...values,
          // Sayılar değişmiş olabilir (attribution geriye dönük işler); eski AI
          // analizi bayatladı — dürüstçe sıfırlanır, kullanıcı isterse yeniden
          // analiz koşar (Insufficient Data kapıları aynen geçerli).
          analysisStatus: null,
          analysisError: null,
        },
      })
    : await prisma.campaignResult.create({
        data: {
          planId: input.planId,
          periodStart: parsed.data.periodStart,
          periodEnd: parsed.data.periodEnd,
          source: "META_API",
          ...values,
        },
      });

  await prisma.metaInsightSync.update({
    where: { id: sync.id },
    data: { status: "COMPLETED", rowCount: draft.rowCount, finishedAt: new Date() },
  });

  return {
    kind: "ok",
    resultId: result.id,
    warnings: draft.warnings,
    updated: existing != null,
  };
}
