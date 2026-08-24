// Yayın hattı aşama mantığının SAF parçası (Prisma/server-only YOK; node testli).
// Aşama sırası: CAMPAIGN → ADSET → MEDIA → CREATIVE → AD → DONE
// (ad, creative_id'ye referans verir; MEDIA görsel yüklemesidir — AGENT-B B3/B4).

import type { StoredTargeting, StoredTargetingItem } from "./types";

export const STAGE_ORDER = ["CAMPAIGN", "ADSET", "MEDIA", "CREATIVE", "AD"] as const;
export type PublishStage = (typeof STAGE_ORDER)[number];
export type PublishStageOrDone = PublishStage | "DONE";

/** Aşama başına en fazla deneme; üstü FAILED (sonsuz döngü koruması). */
export const MAX_STAGE_ATTEMPTS = 3;
/** Bayat claim eşiği — Arena deseniyle aynı (90 sn). */
export const CLAIM_STALE_MS = 90_000;

export function nextStage(stage: PublishStage): PublishStageOrDone {
  const i = STAGE_ORDER.indexOf(stage);
  return i === STAGE_ORDER.length - 1 ? "DONE" : STAGE_ORDER[i + 1];
}

export function isPublishStage(s: string): s is PublishStage {
  return (STAGE_ORDER as readonly string[]).includes(s);
}

/** Kullanıcının yayın ekranında ONAYLADIĞI seçimler (MetaPublish.request.selection). */
export type PublishSelection = {
  creativeId: string;
  imageId: string;
  destinationUrl: string;
  /** publish-kit eşlemesinden geçen CTA enum'u; eşleşmezse null (CTA'sız gider) */
  ctaEnum: string | null;
  /** sales amacında kullanıcının seçtiği dönüşüm olayı */
  customEventType: string | null;
  /** traffic amacında optimizasyon tercihi */
  trafficGoal: "LINK_CLICKS" | "LANDING_PAGE_VIEWS" | null;
  campaignName: string;
  adSetName: string;
  adName: string;
  /** LIFETIME bütçede zorunlu tarih aralığı (ISO) */
  startTime: string | null;
  endTime: string | null;
};

export type PublishRequestJson = {
  version: 1;
  selection: PublishSelection;
  /** aşama → deneme sayısı (şemada stageAttempts alanı yok; burada tutulur) */
  attempts: Partial<Record<PublishStage, number>>;
  /** aşama → Meta'ya GÖNDERİLEN payload (çağrıdan ÖNCE yazılır — çökme teşhisi) */
  sent: Partial<Record<PublishStage, unknown>>;
};

export type PublishResponseJson = Partial<
  Record<PublishStage, { id?: string; hash?: string }>
>;

export function readRequestJson(json: unknown): PublishRequestJson | null {
  if (!json || typeof json !== "object") return null;
  const r = json as Partial<PublishRequestJson>;
  if (r.version !== 1 || !r.selection || typeof r.selection !== "object") return null;
  return {
    version: 1,
    selection: r.selection as PublishSelection,
    attempts: r.attempts && typeof r.attempts === "object" ? r.attempts : {},
    sent: r.sent && typeof r.sent === "object" ? r.sent : {},
  };
}

export function readResponseJson(json: unknown): PublishResponseJson {
  if (!json || typeof json !== "object") return {};
  return json as PublishResponseJson;
}

/** Çökme sonrası yetim riski: payload gönderilmiş (sent yazılmış) ama cevap
 *  kaydedilmemiş. Bu durumda KÖRLEMESİNE yeniden create yapılmaz (Arena dersi):
 *  çağrı Meta'ya ulaşmış ama süreç ID'yi yazamadan ölmüş olabilir → çift nesne.
 *  Kullanıcıya dürüst mesaj + elle "güvenli tekrar" gerekir. */
export function hasOrphanRisk(
  req: PublishRequestJson | null,
  res: PublishResponseJson,
  stage: PublishStage,
): boolean {
  if (!req) return false;
  return stage in req.sent && !(stage in res);
}

/** adimages cevabı: {"images": {"<ad>": {"hash": "..."}}} → hash. */
export function parseAdImagesResponse(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const images = (json as { images?: Record<string, { hash?: unknown }> }).images;
  if (!images || typeof images !== "object") return null;
  for (const v of Object.values(images)) {
    if (v && typeof v === "object" && typeof v.hash === "string" && v.hash) return v.hash;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Saklı hedefleme doğrulaması (CampaignPlan.metaTargeting)
// ---------------------------------------------------------------------------

function readItems(raw: unknown): StoredTargetingItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: StoredTargetingItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") return null;
    const o = it as Record<string, unknown>;
    if (
      typeof o.id !== "string" ||
      !/^\d+$/.test(o.id) ||
      typeof o.name !== "string" ||
      !o.name ||
      o.source !== "meta_search" ||
      typeof o.retrievedAt !== "string"
    ) {
      return null; // aramadan gelmeyen / bozuk nesne → tümü reddedilir (CLAUDE.md §6)
    }
    out.push({
      id: o.id,
      name: o.name,
      type: typeof o.type === "string" ? o.type : "",
      audienceSizeLowerBound:
        typeof o.audienceSizeLowerBound === "number" ? o.audienceSizeLowerBound : null,
      audienceSizeUpperBound:
        typeof o.audienceSizeUpperBound === "number" ? o.audienceSizeUpperBound : null,
      path: Array.isArray(o.path) ? (o.path as string[]) : null,
      source: "meta_search",
      retrievedAt: o.retrievedAt,
    });
  }
  return out;
}

/** metaTargeting Json → StoredTargeting; bozuksa null (UI "hedefleme seçilmedi" der). */
export function readStoredTargeting(json: unknown): StoredTargeting | null {
  if (!json || typeof json !== "object") return null;
  const t = json as Record<string, unknown>;
  if (t.version !== 1) return null;
  if (!Array.isArray(t.countries) || t.countries.length === 0) return null;
  const countries = t.countries.filter(
    (c): c is string => typeof c === "string" && /^[A-Z]{2}$/.test(c),
  );
  if (countries.length !== t.countries.length) return null;
  const interests = readItems(t.interests ?? []);
  const behaviors = readItems(t.behaviors ?? []);
  if (!interests || !behaviors) return null;
  const gender = t.gender;
  if (gender !== "all" && gender !== "men" && gender !== "women") return null;
  if (typeof t.advantageAudience !== "boolean") return null;
  return {
    version: 1,
    countries,
    ageMin: typeof t.ageMin === "number" ? t.ageMin : null,
    ageMax: typeof t.ageMax === "number" ? t.ageMax : null,
    gender,
    interests,
    behaviors,
    advantageAudience: t.advantageAudience,
  };
}
