// Meta yayın hattı — saf tip sözleşmesi (AGENT-B.md §2.3, CONTRACTS §5).
// server-only / Prisma importu YOK: payload üreticileri node testiyle koşar.
// Her alanın dayanağı: docs/meta/SOURCES-B.md (retrieved 2026-08-24).

/** Aramadan dönen GERÇEK Meta hedefleme nesnesi (uydurma ID yasak — CLAUDE.md §6).
 *  source alanı sabittir: yalnız Meta aramasından gelen nesne saklanır. */
export type StoredTargetingItem = {
  id: string;
  name: string;
  /** Meta'nın döndürdüğü tip: "interests" | "behaviors" | "demographics" ... */
  type: string;
  audienceSizeLowerBound: number | null;
  audienceSizeUpperBound: number | null;
  path: string[] | null;
  source: "meta_search";
  retrievedAt: string; // ISO
};

/** CampaignPlan.metaTargeting (Json) içinde saklanan yapı — B1 yazar, yayın hattı okur. */
export type StoredTargeting = {
  version: 1;
  /** ISO 3166-1 alpha-2; kullanıcı seçimi (marka pazarı yalnız öneri) */
  countries: string[];
  ageMin: number | null;
  ageMax: number | null;
  gender: "all" | "men" | "women";
  /** type === "interests" nesneleri */
  interests: StoredTargetingItem[];
  /** type === "behaviors" | "demographics" nesneleri */
  behaviors: StoredTargetingItem[];
  /** targeting_automation.advantage_audience — v23+'da zorunlu bayrak (SOURCES-B §8).
   *  Kullanıcı seçer; varsayılan dayatılmaz (UI'da açık seçim). */
  advantageAudience: boolean;
};

/** Yayın için gereken plan alt kümesi (Prisma'dan bağımsız). */
export type PublishPlanInput = {
  id: string;
  goal: string;
  budgetType: "DAILY" | "LIFETIME";
  /** Decimal → string ("250" | "250.50"); kullanıcının onayladığı bütçe (§19) */
  budgetAmount: string;
  currency: string;
  durationDays: number | null;
  /** Plan sonucundaki objective key: awareness|traffic|engagement|leads|app_promotion|sales */
  objectiveKey: string;
  /** Kullanıcının CEVAPLADIĞI özel reklam kategorileri (B1; varsayılan yok).
   *  Kategori yoksa boş dizi — API alanı yine de zorunlu (SOURCES-B §1). */
  specialAdCategories: string[];
};

/** Markanın bağlı Meta varlıkları (A'nın requireBrandBinding çıktısının alt kümesi). */
export type PublishBindingInput = {
  adAccountId: string; // "act_..."
  pageId: string;
  instagramActorId: string | null; // payload'da instagram_user_id olarak gider (SOURCES-B §4)
  pixelId: string | null;
  currency: string; // ad account para birimi
};

/** Onaylı creative'in yayına giden alanları — Meta'ya giden metin yalnız bunlardır (§16). */
export type PublishCreativeInput = {
  id: string;
  headline: string;
  primaryText: string;
  description: string | null;
  /** publish-kit eşlemesinden geçen CTA enum'u (ör. "SHOP_NOW"); eşleşme yoksa null */
  ctaEnum: string | null;
  /** Reklamın hedef URL'i (kullanıcı girdisi; brand.website varsayılan önerisi) */
  destinationUrl: string;
  /** act hesabına yüklenmiş görselin hash'i (B3 medya yükleme adımından) */
  imageHash: string;
};

/** Bu sprintte API yayın yolu desteklenen amaçlar ve doğrulanmış optimization goal'ları
 *  (SOURCES-B §13–§14). Diğer amaçlar PublishKit'e dürüstçe yönlendirilir. */
export type SupportedObjective = "traffic" | "sales";

export type OptimizationChoice = {
  optimizationGoal: string;
  billingEvent: string;
  /** OFFSITE_CONVERSIONS için zorunlu (pixel_id + custom_event_type) */
  promotedObject: { pixel_id: string; custom_event_type: string } | null;
};
