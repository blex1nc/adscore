import "server-only";
// YAYIN HATTI ÇEKİRDEĞİ (B4) — aşama aşama, claim'li, idempotent.
// Akış: Önizleme → kullanıcı onayı → CAMPAIGN → ADSET → MEDIA → CREATIVE → AD (hepsi PAUSED).
// Her Meta yazımı: assertPublishAllowed + assertSafePayload + audit (CONTRACTS §1/§4).
// Çökme güvenliği: payload çağrıdan ÖNCE request.sent'e yazılır; cevap gelmeden
// süreç ölürse aşama KÖRLEMESİNE tekrarlanmaz (çift kampanya riski — Arena dersi).

import { prisma, type Prisma } from "@adscore/db";
import { audit } from "@/lib/audit";
import {
  MetaApiError,
  MetaBlockedError,
  requireBrandBinding,
} from "@/lib/meta/client";
import { assertPublishAllowed, assertSafePayload } from "@/lib/meta/guards";
import {
  loadImageBytes,
  loadPublishSource,
  publishBlockers,
  toPublishPlanInput,
  type PublishSource,
} from "./access";
import {
  buildAdPayload,
  buildAdSetPayload,
  buildCampaignPayload,
  buildCreativePayload,
  MetaPayloadError,
  resolveOptimization,
  adsManagerAdSetUrl,
  adsManagerAdUrl,
  adsManagerCampaignUrl,
} from "./payloads";
import {
  CLAIM_STALE_MS,
  MAX_STAGE_ATTEMPTS,
  hasOrphanRisk,
  isPublishStage,
  nextStage,
  parseAdImagesResponse,
  readRequestJson,
  readResponseJson,
  readStoredTargeting,
  type PublishSelection,
  type PublishStage,
} from "./stages";
import type { PublishBindingInput, PublishCreativeInput } from "./types";

export type PublishSnapshot = {
  id: string;
  status: string;
  stage: string;
  error: string | null;
  ids: {
    campaign: string | null;
    adSet: string | null;
    creative: string | null;
    ad: string | null;
  };
  links: { campaign: string | null; adSet: string | null; ad: string | null };
};

type PublishRow = NonNullable<Awaited<ReturnType<typeof loadOwnedPublish>>>;

async function loadOwnedPublish(publishId: string, userId: string) {
  return prisma.metaPublish.findFirst({
    where: { id: publishId, plan: { brand: { workspace: { ownerId: userId } } } },
  });
}

function snapshot(row: PublishRow, adAccountId: string | null): PublishSnapshot {
  return {
    id: row.id,
    status: row.status,
    stage: row.stage,
    error: row.error,
    ids: {
      campaign: row.metaCampaignId,
      adSet: row.metaAdSetId,
      creative: row.metaCreativeId,
      ad: row.metaAdId,
    },
    links: {
      campaign:
        adAccountId && row.metaCampaignId
          ? adsManagerCampaignUrl(adAccountId, row.metaCampaignId)
          : null,
      adSet:
        adAccountId && row.metaAdSetId
          ? adsManagerAdSetUrl(adAccountId, row.metaAdSetId)
          : null,
      ad: adAccountId && row.metaAdId ? adsManagerAdUrl(adAccountId, row.metaAdId) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Önizleme için payload kurulumu (dry) — onaydan önce kullanıcıya gösterilir (§9)
// ---------------------------------------------------------------------------

export function buildAllPayloads(input: {
  source: PublishSource;
  binding: PublishBindingInput;
  selection: PublishSelection;
}) {
  const { source, binding, selection } = input;
  const plan = toPublishPlanInput(source);
  if (!plan) throw new MetaPayloadError("Plan sonucundan reklam amacı çıkarılamadı.");
  const targeting = readStoredTargeting(source.metaTargeting);
  if (!targeting) {
    throw new MetaPayloadError("Meta hedeflemesi seçilmemiş veya bozuk. Hedefleme adımını tamamlayın.");
  }
  const creative = source.creatives.find((c) => c.id === selection.creativeId);
  if (!creative) throw new MetaPayloadError("Seçilen creative onaylı creative'ler arasında yok.");
  if (!creative.images.some((i) => i.id === selection.imageId)) {
    throw new MetaPayloadError("Seçilen görsel bu creative'e ait değil veya tamamlanmamış.");
  }
  const optimization = resolveOptimization({
    objectiveKey: plan.objectiveKey,
    pixelId: binding.pixelId,
    customEventType: selection.customEventType,
    trafficGoal: selection.trafficGoal ?? undefined,
  });
  const campaign = buildCampaignPayload({ plan, campaignName: selection.campaignName });
  const adSet = buildAdSetPayload({
    plan,
    binding,
    campaignId: "<CAMPAIGN_ID>", // önizlemede yer tutucu; gerçek aşamada doldurulur
    adSetName: selection.adSetName,
    targeting,
    optimization,
    startTime: selection.startTime ?? undefined,
    endTime: selection.endTime ?? undefined,
  });
  const creativeInput: PublishCreativeInput = {
    id: creative.id,
    headline: creative.headline,
    primaryText: creative.primaryText,
    description: creative.description,
    ctaEnum: selection.ctaEnum,
    destinationUrl: selection.destinationUrl,
    imageHash: "<IMAGE_HASH>", // önizlemede yer tutucu; MEDIA aşaması doldurur
  };
  const creativePayload = buildCreativePayload({
    creative: creativeInput,
    binding,
    creativeName: `${selection.adName} — creative`,
  });
  const ad = buildAdPayload({
    adName: selection.adName,
    adSetId: "<ADSET_ID>",
    creativeId: "<CREATIVE_ID>",
  });
  return { plan, targeting, optimization, campaign, adSet, creativePayload, ad, creativeInput };
}

/** Önizleme + onay öncesi kuru doğrulama: payload'lar kurulur ve guard'lardan
 *  geçirilir — sorun varsa hiçbir şey oluşmadan TR mesajla döner. */
export function dryRunGuards(input: {
  payloads: ReturnType<typeof buildAllPayloads>;
  maxDailyBudget: string | null;
}) {
  const { payloads, maxDailyBudget } = input;
  const planRef = {
    budgetAmount: payloads.plan.budgetAmount,
    currency: payloads.plan.currency,
  };
  assertSafePayload({ kind: "create", payload: payloads.campaign, plan: planRef, maxDailyBudget });
  assertSafePayload({ kind: "create", payload: payloads.adSet, plan: planRef, maxDailyBudget });
  // Status'süz varlık payload'ları (creative) guard'ın KATI moduyla doğrulanır:
  // update modu status/bütçe/bid alanlarını TÜMÜYLE yasaklar (REPORT-B notu #2).
  assertSafePayload({ kind: "update", payload: payloads.creativePayload });
  assertSafePayload({ kind: "create", payload: payloads.ad, plan: planRef, maxDailyBudget });
}

// ---------------------------------------------------------------------------
// Taslak oluşturma + onay
// ---------------------------------------------------------------------------

/** Yayın taslağı: seçimleri DRAFT satırına yazar; Meta'ya HİÇBİR ŞEY gitmez.
 *  Mevcut RUNNING/COMPLETED yayın varsa yenisi açılmaz (çift kampanya koruması). */
export async function ensureDraft(input: {
  planId: string;
  userId: string;
  selection: PublishSelection;
}): Promise<{ publishId: string } | { error: string }> {
  const source = await loadPublishSource(input.planId, input.userId);
  if (!source) return { error: "Plan bulunamadı." };
  const blockers = publishBlockers(source);
  if (blockers.length > 0) return { error: blockers.join(" ") };

  const existing = source.publishes[0];
  if (existing && (existing.status === "RUNNING" || existing.status === "COMPLETED")) {
    return {
      error:
        existing.status === "RUNNING"
          ? "Bu plan için süren bir yayın var; önce onun bitmesini bekleyin."
          : "Bu plan zaten Meta'da oluşturulmuş (PAUSED). Tekrar oluşturma kapalı.",
    };
  }

  // Seçimler + payload'lar kuru doğrulanır (binding dahil) — onaydan önce dürüst hata
  const binding = await requireBrandBinding(source.brand.id);
  const payloads = buildAllPayloads({ source, binding, selection: input.selection });
  dryRunGuards({
    payloads,
    maxDailyBudget: source.brand.workspace.maxDailyBudget?.toString() ?? null,
  });

  const request: Prisma.InputJsonValue = {
    version: 1,
    selection: input.selection as unknown as Prisma.InputJsonValue,
    attempts: {},
    sent: {},
  } as unknown as Prisma.InputJsonValue;

  if (existing && (existing.status === "DRAFT" || existing.status === "FAILED")) {
    // FAILED satırı Meta ID'leri taşıyorsa seçim DEĞİŞTİRİLEMEZ (kısmi nesneler var);
    // yalnız hiç nesne oluşmamış satır taslak olarak güncellenir.
    if (existing.metaCampaignId || existing.metaAdSetId || existing.metaCreativeId || existing.metaAdId) {
      return {
        error:
          "Önceki yayın kısmen oluşmuş (Meta'da nesneler var). Seçim değiştirilemez; 'Kaldığı yerden sürdür' kullanın.",
      };
    }
    await prisma.metaPublish.update({
      where: { id: existing.id },
      data: { status: "DRAFT", stage: "CAMPAIGN", request, response: {}, error: null, claimedAt: null },
    });
    return { publishId: existing.id };
  }

  const row = await prisma.metaPublish.create({
    data: {
      planId: source.id,
      brandId: source.brand.id,
      status: "DRAFT",
      stage: "CAMPAIGN",
      request,
      response: {},
      effectiveStatus: "PAUSED",
    },
  });
  return { publishId: row.id };
}

/** Kullanıcı onayı: DRAFT → RUNNING. Onaysız tek nesne oluşmaz (CLAUDE.md §16/§20). */
export async function confirmPublish(input: {
  publishId: string;
  userId: string;
}): Promise<{ ok: true } | { error: string }> {
  const row = await loadOwnedPublish(input.publishId, input.userId);
  if (!row) return { error: "Yayın kaydı bulunamadı." };
  if (row.status !== "DRAFT") return { error: "Yalnız taslak (DRAFT) yayın onaylanabilir." };
  await assertPublishAllowed({ brandId: row.brandId, userId: input.userId });
  await prisma.metaPublish.update({
    where: { id: row.id },
    data: { status: "RUNNING", error: null, claimedAt: null },
  });
  await audit({
    userId: input.userId,
    action: "meta.publish.confirm",
    entity: "MetaPublish",
    entityId: row.id,
    newState: { planId: row.planId, stage: row.stage },
  });
  return { ok: true };
}

/** FAILED yayını elle sürdürme. Yetim riski onayı kullanıcıdan alınır:
 *  ackOrphan=true → "Ads Manager'ı kontrol ettim, devam et" beyanıdır. */
export async function retryPublish(input: {
  publishId: string;
  userId: string;
  ackOrphan: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const row = await loadOwnedPublish(input.publishId, input.userId);
  if (!row) return { error: "Yayın kaydı bulunamadı." };
  if (row.status !== "FAILED") return { error: "Yalnız başarısız (FAILED) yayın tekrar denenebilir." };
  const req = readRequestJson(row.request);
  const res = readResponseJson(row.response);
  const stage = isPublishStage(row.stage) ? row.stage : null;
  if (!stage) return { error: "Yayın aşaması okunamadı." };
  if (hasOrphanRisk(req, res, stage) && !input.ackOrphan) {
    return {
      error:
        "Son denemede çağrı gönderildi ama sonucu kaydedilemedi; Meta'da nesne oluşmuş olabilir. " +
        "Ads Manager'ı kontrol edip 'Kontrol ettim, devam et' ile sürdürün.",
    };
  }
  // Yetim onayıyla: bekleyen sent kaydı temizlenir, deneme sayacı korunur
  if (req && stage in req.sent && input.ackOrphan) {
    delete req.sent[stage];
    req.attempts[stage] = 0;
  }
  await prisma.metaPublish.update({
    where: { id: row.id },
    data: {
      status: "RUNNING",
      error: null,
      claimedAt: null,
      request: (req ?? row.request ?? {}) as Prisma.InputJsonValue,
    },
  });
  await audit({
    userId: input.userId,
    action: "meta.publish.retry",
    entity: "MetaPublish",
    entityId: row.id,
    newState: { stage: row.stage, ackOrphan: input.ackOrphan },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Aşama yürütücüsü — poller her tikte çağırır (Vercel 60 sn: her tik tek aşama)
// ---------------------------------------------------------------------------

export async function advancePublish(publishId: string, userId: string): Promise<PublishSnapshot> {
  let row = await loadOwnedPublish(publishId, userId);
  if (!row) throw new Error("Yayın kaydı bulunamadı.");
  if (row.status !== "RUNNING" || row.stage === "DONE" || !isPublishStage(row.stage)) {
    return snapshotWithAccount(row);
  }
  const stage: PublishStage = row.stage;

  // Claim: yalnız bir çağrı bu aşamayı işler (çift tetikleme = çift kampanya)
  const now = new Date();
  const claimed = await prisma.metaPublish.updateMany({
    where: {
      id: row.id,
      status: "RUNNING",
      stage,
      OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - CLAIM_STALE_MS) } }],
    },
    data: { claimedAt: now },
  });
  if (claimed.count !== 1) return snapshotWithAccount(row);

  row = (await loadOwnedPublish(publishId, userId))!;
  const req = readRequestJson(row.request);
  const res = readResponseJson(row.response);
  if (!req) {
    return failPublish(row, "Yayın kaydının seçimleri okunamadı; taslağı yeniden oluşturun.");
  }

  // Yetim riski: önceki deneme payload'ı göndermiş ama cevabı kaydedememiş
  if (hasOrphanRisk(req, res, stage)) {
    return failPublish(
      row,
      "Önceki denemede Meta çağrısı gönderildi ama sonucu kaydedilemedi (süreç kesintisi). " +
        "Meta'da nesne oluşmuş olabilir — Ads Manager'ı kontrol edin, sonra 'Kontrol ettim, devam et' ile sürdürün.",
    );
  }

  const attempts = (req.attempts[stage] ?? 0) + 1;
  if (attempts > MAX_STAGE_ATTEMPTS) {
    return failPublish(
      row,
      `"${stage}" aşaması ${MAX_STAGE_ATTEMPTS} kez denendi ve tamamlanamadı. Son hata kayıtlıdır; destek için publish id: ${row.id}.`,
    );
  }

  try {
    // Her aşamada kapı yeniden doğrulanır (bağlantı ölmüş olabilir)
    await assertPublishAllowed({ brandId: row.brandId, userId });
    const source = await loadPublishSource(row.planId, userId);
    if (!source) return failPublish(row, "Plan bulunamadı.");
    const binding = await requireBrandBinding(row.brandId);
    const maxDailyBudget = source.brand.workspace.maxDailyBudget?.toString() ?? null;
    const payloads = buildAllPayloads({ source, binding, selection: req.selection });
    const planRef = { budgetAmount: payloads.plan.budgetAmount, currency: payloads.plan.currency };

    // İdempotens: aşamanın ID'si zaten varsa oluşturma atlanır, aşama ilerletilir
    const already =
      (stage === "CAMPAIGN" && row.metaCampaignId) ||
      (stage === "ADSET" && row.metaAdSetId) ||
      (stage === "MEDIA" && res.MEDIA?.hash) ||
      (stage === "CREATIVE" && row.metaCreativeId) ||
      (stage === "AD" && row.metaAdId);
    if (already) {
      return advanceStageRow(row, req, stage, {});
    }

    let payload: Record<string, unknown>;
    let path: string;
    let guardKind: "create" | "update" = "create";

    if (stage === "CAMPAIGN") {
      payload = payloads.campaign;
      path = `${binding.adAccountId}/campaigns`;
    } else if (stage === "ADSET") {
      if (!row.metaCampaignId) return failPublish(row, "Kampanya ID kaydı yok; aşama sırası bozulmuş.");
      payload = { ...payloads.adSet, campaign_id: row.metaCampaignId };
      path = `${binding.adAccountId}/adsets`;
    } else if (stage === "MEDIA") {
      const img = await loadImageBytes(req.selection.imageId, req.selection.creativeId, userId);
      if (!img) return failPublish(row, "Seçilen görsel bulunamadı veya erişim yok.");
      const ext = img.mimeType.includes("jpeg") || img.mimeType.includes("jpg") ? "jpg" : "png";
      payload = {
        bytes: img.data.toString("base64"),
        name: `adscore-${req.selection.imageId}.${ext}`,
      };
      path = `${binding.adAccountId}/adimages`;
      guardKind = "update"; // status'süz varlık → guard'ın katı modu (REPORT-B #2)
    } else if (stage === "CREATIVE") {
      const hash = res.MEDIA?.hash;
      if (!hash) return failPublish(row, "Görsel hash kaydı yok; MEDIA aşaması tamamlanmamış.");
      const creativePayload = buildCreativePayload({
        creative: { ...payloads.creativeInput, imageHash: hash },
        binding,
        creativeName: `${req.selection.adName} — creative`,
      });
      payload = creativePayload;
      path = `${binding.adAccountId}/adcreatives`;
      guardKind = "update"; // status'süz varlık → katı mod
    } else {
      if (!row.metaAdSetId || !row.metaCreativeId) {
        return failPublish(row, "Ad set / creative ID kaydı yok; aşama sırası bozulmuş.");
      }
      payload = buildAdPayload({
        adName: req.selection.adName,
        adSetId: row.metaAdSetId,
        creativeId: row.metaCreativeId,
      });
      path = `${binding.adAccountId}/ads`;
    }

    if (guardKind === "create") {
      assertSafePayload({ kind: "create", payload, plan: planRef, maxDailyBudget });
    } else {
      assertSafePayload({ kind: "update", payload });
    }

    // Çağrıdan ÖNCE gönderilen payload kalıcılaşır (çökme teşhisi). Görsel bayt'ları
    // JSON'a yazılmaz — yalnız ad + uzunluk (log şişmesin, veri zaten DB'de).
    const sentRecord =
      stage === "MEDIA"
        ? { name: (payload as { name: string }).name, byteLength: String(payload.bytes).length }
        : payload;
    req.attempts[stage] = attempts;
    req.sent[stage] = sentRecord;
    await prisma.metaPublish.update({
      where: { id: row.id },
      data: { request: req as unknown as Prisma.InputJsonValue },
    });

    // TEK ATIŞ create: idempotencyKey BİLEREK verilmez → istemci timeout'ta bile
    // otomatik tekrar DENEMEZ (Graph API'de doğrulanmış idempotens yok; tekrar =
    // çift nesne riski). MEDIA hariç: aynı bayt aynı hash'i döndürür, tekrar zararsız.
    const client = binding.client;
    const apiRes = await client.post<Record<string, unknown>>(path, payload, {
      brandId: row.brandId,
      ...(stage === "MEDIA" ? { idempotencyKey: `${row.id}:MEDIA` } : {}),
      timeoutMs: 45_000,
    });

    let stageResult: { id?: string; hash?: string };
    if (stage === "MEDIA") {
      const hash = parseAdImagesResponse(apiRes);
      if (!hash) return failPublish(row, "Görsel yüklendi ama Meta cevabından hash okunamadı.");
      stageResult = { hash };
    } else {
      const id = typeof apiRes.id === "string" ? apiRes.id : null;
      if (!id) return failPublish(row, `Meta "${stage}" cevabında id yok; Ads Manager'ı kontrol edin.`);
      stageResult = { id };
    }

    await audit({
      userId,
      action: `meta.publish.${stage.toLowerCase()}`,
      entity: "MetaPublish",
      entityId: row.id,
      newState: { stage, result: stageResult, effectiveStatus: "PAUSED" },
    });
    return advanceStageRow(row, req, stage, stageResult);
  } catch (e) {
    if (e instanceof MetaBlockedError || e instanceof MetaPayloadError) {
      return failPublish(row, e.userMessage ?? e.message);
    }
    if (e instanceof MetaApiError) {
      // httpStatus 0 = cevap alınamadı (timeout/ağ) → sonuç BİLİNMİYOR; sent kaydı
      // durur, yetim koruması devreye girer. Kesin API hatasında sent temizlenir
      // (nesne oluşmadı → elle tekrar güvenli).
      if (e.httpStatus !== 0 && req && stage in req.sent) {
        // Kesin API hatası: nesne oluşmadı → kapsamdaki req'ten sent temizlenir
        // (yeniden parse edilmez; elle tekrar güvenli kalır).
        delete req.sent[stage];
        await prisma.metaPublish.update({
          where: { id: row.id },
          data: { request: req as unknown as Prisma.InputJsonValue },
        });
      }
      return failPublish(row, e.userMessage);
    }
    const guardMsg =
      e instanceof Error && e.name === "MetaGuardError" ? e.message : null;
    return failPublish(
      row,
      guardMsg ?? "Beklenmeyen bir hata oluştu. Tekrar deneyin; sürerse yayın kaydı id'siyle destek isteyin.",
    );
  }
}

async function advanceStageRow(
  row: PublishRow,
  req: NonNullable<ReturnType<typeof readRequestJson>>,
  stage: PublishStage,
  result: { id?: string; hash?: string },
): Promise<PublishSnapshot> {
  const res = readResponseJson(row.response);
  if (result.id || result.hash) res[stage] = result;
  const next = nextStage(stage);
  const done = next === "DONE";
  const idData: Prisma.MetaPublishUpdateInput = {};
  if (stage === "CAMPAIGN" && result.id) idData.metaCampaignId = result.id;
  if (stage === "ADSET" && result.id) idData.metaAdSetId = result.id;
  if (stage === "CREATIVE" && result.id) idData.metaCreativeId = result.id;
  if (stage === "AD" && result.id) idData.metaAdId = result.id;

  const updated = await prisma.metaPublish.update({
    where: { id: row.id },
    data: {
      ...idData,
      stage: next,
      claimedAt: null,
      response: res as Prisma.InputJsonValue,
      request: req as unknown as Prisma.InputJsonValue,
      ...(done ? { status: "COMPLETED", finishedAt: new Date(), error: null } : {}),
    },
  });
  if (done) {
    // Plan izleri: C insights için (CONTRACTS §3 CampaignPlan alanları)
    await prisma.campaignPlan.update({
      where: { id: row.planId },
      data: {
        metaCampaignId: updated.metaCampaignId,
        metaAdSetId: updated.metaAdSetId,
        metaAdId: updated.metaAdId,
        metaPublishedAt: new Date(),
      },
    });
  }
  return snapshotWithAccount(updated);
}

async function failPublish(row: PublishRow, message: string): Promise<PublishSnapshot> {
  const updated = await prisma.metaPublish.update({
    where: { id: row.id },
    data: { status: "FAILED", error: message, claimedAt: null },
  });
  return snapshotWithAccount(updated);
}

async function snapshotWithAccount(row: PublishRow): Promise<PublishSnapshot> {
  const binding = await prisma.brandMetaBinding.findUnique({
    where: { brandId: row.brandId },
    select: { adAccountId: true },
  });
  return snapshot(row, binding?.adAccountId ?? null);
}
