"use server";
// Meta yayın hattı server action'ları (B1–B5). Tüm Meta çağrıları A'nın
// istemcisi üzerinden (CONTRACTS §4 — doğrudan fetch YASAK). Hatalar TR.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  MetaApiError,
  MetaBlockedError,
  requireBrandBinding,
} from "@/lib/meta/client";
import { assertPublishAllowed } from "@/lib/meta/guards";
import {
  loadImageBytes,
  loadPublishSource,
  toPublishPlanInput,
} from "@/lib/meta-publish/access";
import {
  buildTargetingSpec,
  isCurveInsufficient,
  MetaPayloadError,
  resolveOptimization,
  type OutcomeCurvePoint,
} from "@/lib/meta-publish/payloads";
import {
  advancePublish,
  buildAllPayloads,
  confirmPublish,
  dryRunGuards,
  ensureDraft,
  retryPublish,
  type PublishSnapshot,
} from "@/lib/meta-publish/run";
import {
  parseAdImagesResponse,
  readResponseJson,
  readStoredTargeting,
  type PublishSelection,
} from "@/lib/meta-publish/stages";
import type { StoredTargetingItem } from "@/lib/meta-publish/types";

// Ortak hata zarfı: blocked ≠ error (UI dürüst kapı gösterir — CONTRACTS §4)
export type MetaActionError = {
  error?: string;
  blocked?: { reason: string; userMessage: string; missing?: string[] };
};

function toActionError(e: unknown): MetaActionError {
  if (e instanceof MetaBlockedError) {
    return { blocked: { reason: e.reason, userMessage: e.userMessage, missing: e.missing } };
  }
  if (e instanceof MetaApiError) return { error: e.userMessage };
  if (e instanceof MetaPayloadError) return { error: e.userMessage };
  if (e instanceof Error && e.name === "MetaGuardError") return { error: e.message };
  return { error: "Beklenmeyen bir hata oluştu. Tekrar deneyin." };
}

function publishPath(brandId: string, planId: string) {
  return `/app/brands/${brandId}/campaigns/${planId}/publish`;
}

// ---------------------------------------------------------------------------
// B1 — Hedefleme arama + kaydetme
// ---------------------------------------------------------------------------

export type TargetingSearchItem = {
  id: string;
  name: string;
  type: string;
  audienceSizeLowerBound: number | null;
  audienceSizeUpperBound: number | null;
  path: string[] | null;
};
export type GeoSearchItem = { code: string; name: string };

type RawSearchRow = {
  id?: string | number;
  name?: string;
  type?: string;
  audience_size_lower_bound?: number;
  audience_size_upper_bound?: number;
  path?: string[];
  key?: string;
  country_code?: string;
};

/** Meta hedefleme araması — yalnız buradan dönen nesneler seçilebilir (CLAUDE.md §6). */
export async function searchMetaTargeting(
  brandId: string,
  kind: "interest" | "behavior" | "geo",
  q: string,
): Promise<
  ({ items: TargetingSearchItem[]; geo?: never } | { geo: GeoSearchItem[]; items?: never } | MetaActionError) & {
    retrievedAt?: string;
  }
> {
  const user = await requireUser();
  const query = q.trim().slice(0, 120);
  try {
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, workspace: { ownerId: user.id } },
      select: { id: true },
    });
    if (!brand) return { error: "Marka bulunamadı." };
    const { client } = await requireBrandBinding(brandId);
    const retrievedAt = new Date().toISOString();

    if (kind === "geo") {
      if (!query) return { geo: [], retrievedAt };
      const rows = await client.get<{ data?: RawSearchRow[] }>(
        "search",
        { type: "adgeolocation", location_types: JSON.stringify(["country"]), q: query, limit: 20 },
        { brandId },
      );
      const geo = (rows.data ?? [])
        .filter((r) => typeof r.country_code === "string")
        .map((r) => ({ code: r.country_code!.toUpperCase(), name: r.name ?? r.country_code! }));
      return { geo, retrievedAt };
    }

    let rows: RawSearchRow[];
    if (kind === "interest") {
      if (!query) return { items: [], retrievedAt };
      const res = await client.get<{ data?: RawSearchRow[] }>(
        "search",
        { type: "adinterest", q: query, limit: 25 },
        { brandId },
      );
      rows = res.data ?? [];
    } else {
      // adTargetingCategory: q parametresini YOK SAYAR (SOURCES-B §6) → sunucuda filtre
      const res = await client.get<{ data?: RawSearchRow[] }>(
        "search",
        { type: "adTargetingCategory", class: "behaviors", limit: 250 },
        { brandId },
      );
      const nq = query.toLocaleLowerCase("tr");
      rows = (res.data ?? []).filter(
        (r) => !nq || (r.name ?? "").toLocaleLowerCase("tr").includes(nq),
      );
    }
    const items: TargetingSearchItem[] = rows
      .filter((r) => r.id != null && typeof r.name === "string")
      .slice(0, 25)
      .map((r) => ({
        id: String(r.id),
        name: r.name!,
        type: r.type ?? (kind === "interest" ? "interests" : "behaviors"),
        audienceSizeLowerBound: r.audience_size_lower_bound ?? null,
        audienceSizeUpperBound: r.audience_size_upper_bound ?? null,
        path: Array.isArray(r.path) ? r.path : null,
      }));
    return { items, retrievedAt };
  } catch (e) {
    return toActionError(e);
  }
}

const targetingItemSchema = z.object({
  id: z.string().regex(/^\d+$/),
  name: z.string().min(1).max(200),
  type: z.string().max(60),
  audienceSizeLowerBound: z.number().nullable(),
  audienceSizeUpperBound: z.number().nullable(),
  path: z.array(z.string()).nullable(),
  retrievedAt: z.string(),
});

const saveTargetingSchema = z.object({
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(25),
  ageMin: z.number().int().min(13).max(65).nullable(),
  ageMax: z.number().int().min(13).max(65).nullable(),
  gender: z.enum(["all", "men", "women"]),
  interests: z.array(targetingItemSchema).max(50),
  behaviors: z.array(targetingItemSchema).max(50),
  advantageAudience: z.boolean(),
  specialAdCategories: z
    .array(z.enum(["NONE", "CREDIT", "FINANCIAL_PRODUCTS_SERVICES", "EMPLOYMENT", "HOUSING", "ISSUES_ELECTIONS_POLITICS", "ONLINE_GAMBLING_AND_GAMING"]))
    .min(1)
    .max(6),
});

export type SaveTargetingInput = z.infer<typeof saveTargetingSchema>;

/** Seçilen hedefleme + özel reklam kategorisi cevabı plana yazılır (B1). */
export async function saveMetaTargeting(
  planId: string,
  input: SaveTargetingInput,
): Promise<{ ok: true } | MetaActionError> {
  const user = await requireUser();
  const parsed = saveTargetingSchema.safeParse(input);
  if (!parsed.success) return { error: "Hedefleme verisi geçersiz. Seçimleri kontrol edin." };
  const d = parsed.data;
  if (d.ageMin != null && d.ageMax != null && d.ageMin > d.ageMax) {
    return { error: "Yaş aralığı geçersiz: alt sınır üst sınırdan büyük." };
  }
  if (d.specialAdCategories.includes("NONE") && d.specialAdCategories.length > 1) {
    return { error: "Özel kategori seçiminde 'Yok' diğer kategorilerle birlikte seçilemez." };
  }
  const source = await loadPublishSource(planId, user.id);
  if (!source) return { error: "Plan bulunamadı." };

  const toItem = (i: z.infer<typeof targetingItemSchema>): StoredTargetingItem => ({
    ...i,
    source: "meta_search",
  });
  const stored = {
    version: 1 as const,
    countries: d.countries,
    ageMin: d.ageMin,
    ageMax: d.ageMax,
    gender: d.gender,
    interests: d.interests.map(toItem),
    behaviors: d.behaviors.map(toItem),
    advantageAudience: d.advantageAudience,
  };
  if (!readStoredTargeting(stored)) return { error: "Hedefleme verisi doğrulanamadı." };
  // Spec kurulumu da doğrulanır (ülke zorunluluğu vb.) — hatalıysa kaydedilmez
  try {
    buildTargetingSpec(stored);
  } catch (e) {
    return toActionError(e);
  }
  await prisma.campaignPlan.update({
    where: { id: source.id },
    data: {
      metaTargeting: stored as unknown as Prisma.InputJsonValue,
      specialAdCategories: d.specialAdCategories,
    },
  });
  await audit({
    userId: user.id,
    action: "meta.targeting.save",
    entity: "CampaignPlan",
    entityId: source.id,
    newState: {
      countries: d.countries,
      interestCount: d.interests.length,
      behaviorCount: d.behaviors.length,
      specialAdCategories: d.specialAdCategories,
      advantageAudience: d.advantageAudience,
    },
  });
  revalidatePath(publishPath(source.brand.id, source.id));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// B2 — Teslimat tahmini (yalnız Meta'nın kendi sayıları — CLAUDE.md §6/§31)
// ---------------------------------------------------------------------------

export type DeliveryEstimateResult =
  | {
      status: "ok";
      retrievedAt: string;
      estimateReady: boolean;
      mauLower: number | null;
      mauUpper: number | null;
      curve: OutcomeCurvePoint[];
    }
  | { status: "insufficient"; retrievedAt: string; note: string }
  | MetaActionError;

export async function getDeliveryEstimate(
  planId: string,
  opts: { customEventType?: string | null; trafficGoal?: "LINK_CLICKS" | "LANDING_PAGE_VIEWS" | null },
): Promise<DeliveryEstimateResult> {
  const user = await requireUser();
  try {
    const source = await loadPublishSource(planId, user.id);
    if (!source) return { error: "Plan bulunamadı." };
    const plan = toPublishPlanInput(source);
    if (!plan) return { error: "Plan sonucundan reklam amacı çıkarılamadı." };
    const targeting = readStoredTargeting(source.metaTargeting);
    if (!targeting) return { error: "Önce Meta hedeflemesini seçip kaydedin." };
    const binding = await requireBrandBinding(source.brand.id);
    const optimization = resolveOptimization({
      objectiveKey: plan.objectiveKey,
      pixelId: binding.pixelId,
      customEventType: opts.customEventType,
      trafficGoal: opts.trafficGoal ?? undefined,
    });
    const spec = buildTargetingSpec(targeting);
    const params: Record<string, string | number> = {
      optimization_goal: optimization.optimizationGoal,
      targeting_spec: JSON.stringify(spec),
    };
    if (optimization.promotedObject) {
      params.promoted_object = JSON.stringify(optimization.promotedObject);
    }
    const res = await binding.client.get<{
      data?: Array<{
        estimate_ready?: boolean;
        estimate_mau_lower_bound?: number;
        estimate_mau_upper_bound?: number;
        daily_outcomes_curve?: OutcomeCurvePoint[];
      }>;
    }>(`${binding.adAccountId}/delivery_estimate`, params, { brandId: source.brand.id });
    const retrievedAt = new Date().toISOString();
    const node = res.data?.[0];
    const curve = node?.daily_outcomes_curve;
    // Resmî davranış: güven yoksa eğri boş YA DA tek nokta hepsi-0 (SOURCES-B §9)
    if (!node || node.estimate_ready === false || isCurveInsufficient(curve)) {
      return {
        status: "insufficient",
        retrievedAt,
        note: "Insufficient Data — Meta bu hedefleme için güvenli tahmin üretmiyor. Kendi tahminimizi üretmeyiz.",
      };
    }
    return {
      status: "ok",
      retrievedAt,
      estimateReady: node.estimate_ready ?? true,
      mauLower: node.estimate_mau_lower_bound ?? null,
      mauUpper: node.estimate_mau_upper_bound ?? null,
      curve: (curve ?? []).slice(0, 12),
    };
  } catch (e) {
    return toActionError(e);
  }
}

// ---------------------------------------------------------------------------
// B3+B5 — Görsel yükleme + resmî önizleme (onay ÖNCESİ, açık beyanla)
// ---------------------------------------------------------------------------

const PREVIEW_FORMATS = [
  { key: "MOBILE_FEED_STANDARD", label: "Facebook Akış (mobil)" },
  { key: "INSTAGRAM_STANDARD", label: "Instagram Akış" },
  { key: "INSTAGRAM_STORY", label: "Instagram Hikâye" },
] as const;

export type OfficialPreviewResult =
  | {
      previews: Array<{ format: string; label: string; body: string }>;
      failed: Array<{ format: string; label: string; reason: string }>;
      imageHash: string;
    }
  | MetaActionError;

/** Seçili görseli reklam hesabına yükler (asset kütüphanesi — kampanya nesnesi DEĞİL,
 *  harcama yok) ve Meta'nın kendi render'ıyla önizleme döner. Hash DRAFT satırına
 *  yazılır; yayın hattı MEDIA aşamasını atlar. */
export async function getOfficialPreviews(publishId: string): Promise<OfficialPreviewResult> {
  const user = await requireUser();
  try {
    const row = await prisma.metaPublish.findFirst({
      where: { id: publishId, plan: { brand: { workspace: { ownerId: user.id } } } },
    });
    if (!row) return { error: "Yayın taslağı bulunamadı." };
    await assertPublishAllowed({ brandId: row.brandId, userId: user.id });
    const source = await loadPublishSource(row.planId, user.id);
    if (!source) return { error: "Plan bulunamadı." };
    const binding = await requireBrandBinding(row.brandId);
    const req = row.request as { selection?: PublishSelection } | null;
    const selection = req?.selection;
    if (!selection) return { error: "Yayın taslağının seçimleri okunamadı." };

    // 1) Görsel hash: varsa yeniden yüklenmez (idempotent — aynı bayt = aynı hash)
    const res = readResponseJson(row.response);
    let imageHash = res.MEDIA?.hash ?? null;
    if (!imageHash) {
      const img = await loadImageBytes(selection.imageId, selection.creativeId, user.id);
      if (!img) return { error: "Seçilen görsel bulunamadı." };
      const ext = img.mimeType.includes("jpe") ? "jpg" : "png";
      const uploadRes = await binding.client.post<Record<string, unknown>>(
        `${binding.adAccountId}/adimages`,
        { bytes: img.data.toString("base64"), name: `adscore-${selection.imageId}.${ext}` },
        { brandId: row.brandId, idempotencyKey: `${row.id}:MEDIA` },
      );
      imageHash = parseAdImagesResponse(uploadRes);
      if (!imageHash) return { error: "Görsel yüklendi ama Meta cevabından hash okunamadı." };
      res.MEDIA = { hash: imageHash };
      await prisma.metaPublish.update({
        where: { id: row.id },
        data: { response: res as Prisma.InputJsonValue },
      });
      await audit({
        userId: user.id,
        action: "meta.publish.media_upload",
        entity: "MetaPublish",
        entityId: row.id,
        newState: { imageId: selection.imageId, hash: imageHash },
      });
    }

    // 2) Resmî önizleme: creative spec (nesne OLUŞTURULMAZ — yalnız render)
    const payloads = buildAllPayloads({ source, binding, selection });
    const spec = {
      ...payloads.creativePayload,
      object_story_spec: {
        ...payloads.creativePayload.object_story_spec,
        link_data: {
          ...payloads.creativePayload.object_story_spec.link_data,
          image_hash: imageHash,
        },
      },
    };
    const previews: Array<{ format: string; label: string; body: string }> = [];
    const failed: Array<{ format: string; label: string; reason: string }> = [];
    for (const f of PREVIEW_FORMATS) {
      try {
        const pr = await binding.client.get<{ data?: Array<{ body?: string }> }>(
          `${binding.adAccountId}/generatepreviews`,
          { creative: JSON.stringify(spec), ad_format: f.key },
          { brandId: row.brandId },
        );
        const body = pr.data?.[0]?.body;
        if (body) previews.push({ format: f.key, label: f.label, body });
        else failed.push({ format: f.key, label: f.label, reason: "Meta önizleme gövdesi döndürmedi." });
      } catch (e) {
        const msg = e instanceof MetaApiError ? e.userMessage : "Önizleme alınamadı.";
        failed.push({ format: f.key, label: f.label, reason: msg });
      }
    }
    return { previews, failed, imageHash };
  } catch (e) {
    return toActionError(e);
  }
}

// ---------------------------------------------------------------------------
// B4 — Taslak / onay / aşama yürütme / tekrar
// ---------------------------------------------------------------------------

const selectionSchema = z.object({
  creativeId: z.string().min(1),
  imageId: z.string().min(1),
  destinationUrl: z.string().url().max(500),
  ctaEnum: z.string().max(60).nullable(),
  customEventType: z.string().max(60).nullable(),
  trafficGoal: z.enum(["LINK_CLICKS", "LANDING_PAGE_VIEWS"]).nullable(),
  campaignName: z.string().min(3).max(200),
  adSetName: z.string().min(3).max(200),
  adName: z.string().min(3).max(200),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
});

export type PreviewPayloads = {
  publishId: string;
  campaign: Record<string, unknown>;
  adSet: Record<string, unknown>;
  creative: Record<string, unknown>;
  ad: Record<string, unknown>;
  budgetDisplay: string;
};

/** Taslak oluştur + payload önizlemesi (HANDOFF §9 Stage 1). Meta'ya hiçbir şey gitmez. */
export async function prepareMetaPublish(
  planId: string,
  selectionInput: z.infer<typeof selectionSchema>,
): Promise<PreviewPayloads | MetaActionError> {
  const user = await requireUser();
  const parsed = selectionSchema.safeParse(selectionInput);
  if (!parsed.success) {
    return { error: "Yayın seçimleri eksik/geçersiz: " + parsed.error.issues.map((i) => i.path.join(".")).join(", ") };
  }
  const selection: PublishSelection = parsed.data;
  try {
    const source = await loadPublishSource(planId, user.id);
    if (!source) return { error: "Plan bulunamadı." };
    await assertPublishAllowed({ brandId: source.brand.id, userId: user.id });
    const draft = await ensureDraft({ planId, userId: user.id, selection });
    if ("error" in draft) return { error: draft.error };
    const binding = await requireBrandBinding(source.brand.id);
    const payloads = buildAllPayloads({ source, binding, selection });
    dryRunGuards({
      payloads,
      maxDailyBudget: source.brand.workspace.maxDailyBudget?.toString() ?? null,
    });
    revalidatePath(publishPath(source.brand.id, planId));
    return {
      publishId: draft.publishId,
      campaign: payloads.campaign,
      adSet: payloads.adSet as unknown as Record<string, unknown>,
      creative: payloads.creativePayload as unknown as Record<string, unknown>,
      ad: payloads.ad,
      budgetDisplay: `${payloads.plan.budgetAmount} ${payloads.plan.currency} (${
        payloads.plan.budgetType === "DAILY" ? "günlük" : "toplam"
      })`,
    };
  } catch (e) {
    return toActionError(e);
  }
}

/** Kullanıcı onayı (HANDOFF §9 Stage 2) — bundan sonra poller aşamaları yürütür. */
export async function confirmMetaPublish(publishId: string): Promise<{ ok: true } | MetaActionError> {
  const user = await requireUser();
  try {
    const r = await confirmPublish({ publishId, userId: user.id });
    if ("error" in r) return { error: r.error };
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function advanceMetaPublish(publishId: string): Promise<PublishSnapshot | MetaActionError> {
  const user = await requireUser();
  try {
    return await advancePublish(publishId, user.id);
  } catch (e) {
    return toActionError(e);
  }
}

export async function retryMetaPublish(
  publishId: string,
  ackOrphan: boolean,
): Promise<{ ok: true } | MetaActionError> {
  const user = await requireUser();
  try {
    const r = await retryPublish({ publishId, userId: user.id, ackOrphan });
    if ("error" in r) return { error: r.error };
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
