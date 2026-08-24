// Meta yayın payload üreticileri — SAF modül (Prisma/server-only YOK; node testli).
// Her alanın dayanağı docs/meta/SOURCES-B.md (resmî doküman, retrieved 2026-08-24).
//
// MUTLAK KURALLAR (CONTRACTS §1, AGENT-B §4):
// - Oluşturulan her nesne status: "PAUSED". ACTIVE bu modülde temsil bile edilemez.
// - Bütçe = kullanıcının onayladığı plan bütçesi, ad account para biriminde, minor unit.
// - Meta'ya giden metin yalnız onaylı creative alanlarıdır; burada metin üretilmez.

import type {
  OptimizationChoice,
  PublishBindingInput,
  PublishCreativeInput,
  PublishPlanInput,
  StoredTargeting,
} from "./types";

// Oluşturma durumunda tek geçerli değerimiz (SOURCES-B §1/§2/§5: create'te ACTIVE|PAUSED;
// bu sprintte yalnız PAUSED — CLAUDE.md §20/§44).
export const PAUSED_STATUS = "PAUSED" as const;

/** Kullanıcıya TR mesajla dönen payload doğrulama hatası (CLAUDE.md §42). */
export class MetaPayloadError extends Error {
  userMessage: string;
  constructor(userMessage: string) {
    super(userMessage);
    this.name = "MetaPayloadError";
    this.userMessage = userMessage;
  }
}

// ---------------------------------------------------------------------------
// Bütçe: minor unit dönüşümü (SOURCES-B §2–§3). Yanlışı 100× harcama demektir.
// ---------------------------------------------------------------------------

/** Offset 1 (ondalıksız) para birimleri — Marketing API currencies sayfasından
 *  (SOURCES-B §3). Listede olmayan her para birimi offset 100 kabul edilir
 *  (TRY/USD/EUR = 100, aynı sayfadan doğrulandı). */
export const OFFSET_ONE_CURRENCIES = new Set([
  "CLP", "COP", "CRC", "HUF", "ISK", "IDR", "JPY", "KRW", "PYG", "TWD", "VND",
]);

export function currencyOffset(currency: string): 1 | 100 {
  return OFFSET_ONE_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
}

/** "250" | "250.5" | "250.50" → minor unit tam sayı (string matematiği; float YOK).
 *  Ondalık sayısı para biriminin offset'inden fazlaysa reddeder (yuvarlama = bütçe değişimi). */
export function toMinorUnits(amount: string, currency: string): number {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new MetaPayloadError(`Bütçe tutarı okunamadı: "${amount}". Plan bütçesini kontrol edin.`);
  }
  const [wholeRaw, fracRaw = ""] = trimmed.split(".");
  const offset = currencyOffset(currency);
  const maxFrac = offset === 100 ? 2 : 0;
  const fracTrimmed = fracRaw.replace(/0+$/, "");
  if (fracTrimmed.length > maxFrac) {
    throw new MetaPayloadError(
      `${currency} için bütçe en fazla ${maxFrac} ondalık basamak alabilir (Meta para birimi offset kuralı). Girilen: ${amount}.`,
    );
  }
  const frac = (fracTrimmed + "0".repeat(maxFrac)).slice(0, maxFrac);
  const minor = Number(`${wholeRaw}${frac}`.replace(/^0+(?=\d)/, ""));
  if (!Number.isSafeInteger(minor) || minor <= 0) {
    throw new MetaPayloadError(`Bütçe tutarı geçersiz: "${amount}". Sıfırdan büyük olmalı.`);
  }
  return minor;
}

/** Minor unit → kullanıcıya gösterilecek tutar (ad account para biriminde). */
export function fromMinorUnits(minor: number, currency: string): string {
  const offset = currencyOffset(currency);
  if (offset === 1) return String(minor);
  const whole = Math.floor(minor / 100);
  const frac = String(minor % 100).padStart(2, "0");
  return `${whole}.${frac}`;
}

/** Plan para birimi ≠ ad account para birimi → yayın YAPILMAZ. Panel kur çevrimi
 *  bilgilendirme amaçlıdır (HANDOFF 21.5); farklı kurda yayın onaylanan harcamayı değiştirir. */
export function assertCurrencyMatch(planCurrency: string, accountCurrency: string): void {
  if (planCurrency.toUpperCase() !== accountCurrency.toUpperCase()) {
    throw new MetaPayloadError(
      `Plan bütçesi ${planCurrency}, bağlı reklam hesabı ise ${accountCurrency} kullanıyor. ` +
        `Meta faturalaması hesap para birimindedir; yayın için planı ${accountCurrency} ile yeniden oluşturun ` +
        `veya ${planCurrency} kullanan bir reklam hesabı bağlayın.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Objective / optimizasyon eşlemesi (SOURCES-B §1, §13, §14)
// ---------------------------------------------------------------------------

/** Plan objective key → ODAX enum (publish-kit OBJECTIVES ile aynı eşleme). */
export const OBJECTIVE_ENUMS: Record<string, string> = {
  awareness: "OUTCOME_AWARENESS",
  traffic: "OUTCOME_TRAFFIC",
  engagement: "OUTCOME_ENGAGEMENT",
  leads: "OUTCOME_LEADS",
  app_promotion: "OUTCOME_APP_PROMOTION",
  sales: "OUTCOME_SALES",
};

/** API yayın yolunun bu sprintte desteklediği amaçlar. Diğerleri PublishKit'e
 *  dürüstçe yönlendirilir (doğrulanmamış kombinasyon göndermeyiz — CLAUDE.md §6). */
export function isSupportedObjective(objectiveKey: string): boolean {
  return objectiveKey === "traffic" || objectiveKey === "sales";
}

/** Amaç → doğrulanmış optimization_goal/billing_event/promoted_object seçimi.
 *  - traffic: LINK_CLICKS | LANDING_PAGE_VIEWS (promoted_object yok) — SOURCES-B §14
 *  - sales:   OFFSITE_CONVERSIONS + pixel_id + custom_event_type — SOURCES-B §13
 *  Pixel yoksa sales için dürüst hata: uydurma fallback yok. */
export function resolveOptimization(input: {
  objectiveKey: string;
  pixelId: string | null;
  /** sales için kullanıcının seçtiği dönüşüm olayı (varsayılan dayatılmaz; UI sorar) */
  customEventType?: string | null;
  /** traffic için kullanıcı tercihi; verilmezse LINK_CLICKS */
  trafficGoal?: "LINK_CLICKS" | "LANDING_PAGE_VIEWS";
}): OptimizationChoice {
  const { objectiveKey, pixelId } = input;
  if (objectiveKey === "traffic") {
    return {
      optimizationGoal: input.trafficGoal ?? "LINK_CLICKS",
      billingEvent: "IMPRESSIONS",
      promotedObject: null,
    };
  }
  if (objectiveKey === "sales") {
    if (!pixelId) {
      throw new MetaPayloadError(
        "Satış amaçlı yayın için markaya bağlı bir Pixel gerekli (dönüşüm optimizasyonu pixel_id ister). " +
          "Ayarlar > Meta bölümünden pixel seçin veya kampanyayı PublishKit ile elle kurun.",
      );
    }
    const event = input.customEventType;
    if (!event) {
      throw new MetaPayloadError(
        "Satış amaçlı yayın için dönüşüm olayı seçilmedi (ör. PURCHASE). Yayın ekranında dönüşüm olayını seçin.",
      );
    }
    return {
      optimizationGoal: "OFFSITE_CONVERSIONS",
      billingEvent: "IMPRESSIONS",
      promotedObject: { pixel_id: pixelId, custom_event_type: event },
    };
  }
  throw new MetaPayloadError(
    `"${objectiveKey}" amacı için API yayın yolu bu sprintte desteklenmiyor. ` +
      "PublishKit ile Ads Manager'da elle kurulum yapabilirsiniz.",
  );
}

/** Satış amacında kullanıcının seçebileceği dönüşüm olayları (SOURCES-B §13
 *  doğrulanmış custom_event_type listesinin e-ticaret alt kümesi; varsayılan dayatılmaz). */
export const CUSTOM_EVENT_TYPES = [
  { value: "PURCHASE", label: "Satın alma (Purchase)" },
  { value: "ADD_TO_CART", label: "Sepete ekleme (AddToCart)" },
  { value: "INITIATED_CHECKOUT", label: "Ödeme başlatma (InitiateCheckout)" },
  { value: "LEAD", label: "Potansiyel müşteri (Lead)" },
  { value: "COMPLETE_REGISTRATION", label: "Kayıt tamamlama (CompleteRegistration)" },
  { value: "CONTENT_VIEW", label: "İçerik görüntüleme (ViewContent)" },
  { value: "SUBSCRIBE", label: "Abonelik (Subscribe)" },
] as const;

// ---------------------------------------------------------------------------
// Targeting spec (SOURCES-B §6–§8)
// ---------------------------------------------------------------------------

export type MetaTargetingSpec = {
  geo_locations: { countries: string[] };
  age_min?: number;
  age_max?: number;
  genders?: number[];
  interests?: Array<{ id: string; name: string }>;
  behaviors?: Array<{ id: string; name: string }>;
  targeting_automation: { advantage_audience: 0 | 1 };
};

/** Saklanan hedefleme (B1'in yazdığı CampaignPlan.metaTargeting) → API targeting spec.
 *  Yalnız aramadan dönen nesneler kullanılır; id'ler burada üretilmez (CLAUDE.md §6). */
export function buildTargetingSpec(stored: StoredTargeting): MetaTargetingSpec {
  if (!stored.countries.length) {
    throw new MetaPayloadError("Hedefleme için en az bir ülke seçilmeli (Meta targeting zorunluluğu).");
  }
  for (const item of [...stored.interests, ...stored.behaviors]) {
    if (item.source !== "meta_search" || !/^\d+$/.test(item.id)) {
      throw new MetaPayloadError(
        `Hedefleme nesnesi Meta aramasından gelmemiş görünüyor: "${item.name}". ` +
          "Yalnız aramadan seçilen nesneler kullanılabilir; hedeflemeyi yeniden seçin.",
      );
    }
  }
  const spec: MetaTargetingSpec = {
    geo_locations: { countries: stored.countries },
    // v23+: non-default hedeflemede bayrak açıkça gönderilmek ZORUNDA (SOURCES-B §8)
    targeting_automation: { advantage_audience: stored.advantageAudience ? 1 : 0 },
  };
  if (stored.ageMin != null) spec.age_min = stored.ageMin;
  if (stored.ageMax != null) spec.age_max = stored.ageMax;
  if (stored.gender === "men") spec.genders = [1];
  if (stored.gender === "women") spec.genders = [2];
  if (stored.interests.length) {
    spec.interests = stored.interests.map((i) => ({ id: i.id, name: i.name }));
  }
  if (stored.behaviors.length) {
    spec.behaviors = stored.behaviors.map((b) => ({ id: b.id, name: b.name }));
  }
  return spec;
}

// ---------------------------------------------------------------------------
// Payload üreticileri (SOURCES-B §1, §2, §4, §5)
// ---------------------------------------------------------------------------

export type CampaignPayload = {
  name: string;
  objective: string;
  special_ad_categories: string[];
  status: typeof PAUSED_STATUS;
  buying_type: "AUCTION";
};

/** POST act_X/campaigns gövdesi. Bütçe kampanya seviyesinde TUTULMAZ (ad set bütçesi);
 *  böylece kampanya payload'ında para alanı hiç yoktur. */
export function buildCampaignPayload(input: {
  plan: PublishPlanInput;
  campaignName: string;
}): CampaignPayload {
  const { plan, campaignName } = input;
  if (!isSupportedObjective(plan.objectiveKey)) {
    throw new MetaPayloadError(
      `"${plan.objectiveKey}" amacı için API yayın yolu bu sprintte desteklenmiyor. PublishKit kullanın.`,
    );
  }
  if (!Array.isArray(plan.specialAdCategories)) {
    throw new MetaPayloadError("Özel reklam kategorisi cevabı eksik. Yayın ekranındaki soruyu cevaplayın.");
  }
  // "NONE" işaretlendiyse API'ye boş dizi gider (SOURCES-B §1: "send an empty array")
  const categories = plan.specialAdCategories.filter((c) => c !== "NONE");
  return {
    name: campaignName,
    objective: OBJECTIVE_ENUMS[plan.objectiveKey],
    special_ad_categories: categories,
    status: PAUSED_STATUS,
    buying_type: "AUCTION",
  };
}

export type AdSetPayload = {
  name: string;
  campaign_id: string;
  status: typeof PAUSED_STATUS;
  optimization_goal: string;
  billing_event: string;
  targeting: MetaTargetingSpec;
  daily_budget?: number;
  lifetime_budget?: number;
  start_time?: string;
  end_time?: string;
  promoted_object?: { pixel_id: string; custom_event_type: string };
};

/** POST act_X/adsets gövdesi. Bütçe = onaylı plan bütçesi, hesap para biriminde,
 *  minor unit (SOURCES-B §2–§3). bid_strategy gönderilmez → LOWEST_COST_WITHOUT_CAP
 *  (bid_amount gerekmez; bid alanı bu sprintte yazılmaz). */
export function buildAdSetPayload(input: {
  plan: PublishPlanInput;
  binding: PublishBindingInput;
  campaignId: string;
  adSetName: string;
  targeting: StoredTargeting;
  optimization: OptimizationChoice;
  /** LIFETIME bütçede zorunlu; UI'dan (varsayılan: şimdi + durationDays gün) */
  startTime?: string;
  endTime?: string;
}): AdSetPayload {
  const { plan, binding, campaignId, adSetName, optimization } = input;
  assertCurrencyMatch(plan.currency, binding.currency);
  const minor = toMinorUnits(plan.budgetAmount, binding.currency);
  const payload: AdSetPayload = {
    name: adSetName,
    campaign_id: campaignId,
    status: PAUSED_STATUS,
    optimization_goal: optimization.optimizationGoal,
    billing_event: optimization.billingEvent,
    targeting: buildTargetingSpec(input.targeting),
  };
  if (plan.budgetType === "DAILY") {
    payload.daily_budget = minor;
  } else {
    payload.lifetime_budget = minor;
    // lifetime_budget ile end_time ZORUNLU (SOURCES-B §2)
    if (!input.startTime || !input.endTime) {
      throw new MetaPayloadError(
        "Toplam bütçeli plan için başlangıç ve bitiş zamanı gerekli (Meta lifetime_budget kuralı). " +
          "Yayın ekranında tarih aralığını belirleyin.",
      );
    }
    payload.start_time = input.startTime;
    payload.end_time = input.endTime;
  }
  if (optimization.promotedObject) payload.promoted_object = optimization.promotedObject;
  return payload;
}

export type CreativePayload = {
  name: string;
  object_story_spec: {
    page_id: string;
    instagram_user_id?: string;
    link_data: {
      link: string;
      message: string;
      name: string;
      description?: string;
      image_hash: string;
      call_to_action?: { type: string; value: { link: string } };
    };
  };
};

/** POST act_X/adcreatives gövdesi (SOURCES-B §4). page_id zorunlu; IG hesabı
 *  varsa GÜNCEL alan adı instagram_user_id ile gönderilir (instagram_actor_id
 *  object_story_spec'te yok). Metinler yalnız ONAYLI creative'den gelir (§16). */
export function buildCreativePayload(input: {
  creative: PublishCreativeInput;
  binding: PublishBindingInput;
  creativeName: string;
}): CreativePayload {
  const { creative, binding, creativeName } = input;
  if (!binding.pageId) {
    throw new MetaPayloadError(
      "Facebook Sayfası bağlı değil. Reklam creative'i Page olmadan oluşturulamaz (object_story_spec.page_id zorunlu). " +
        "Ayarlar > Meta bölümünden Sayfa seçin.",
    );
  }
  if (!creative.imageHash) {
    throw new MetaPayloadError("Creative görseli henüz reklam hesabına yüklenmedi. Önce medya yükleme adımını tamamlayın.");
  }
  let url: URL;
  try {
    url = new URL(creative.destinationUrl);
  } catch {
    throw new MetaPayloadError(`Hedef URL geçersiz: "${creative.destinationUrl}". https:// ile tam adres girin.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new MetaPayloadError(`Hedef URL http/https olmalı: "${creative.destinationUrl}".`);
  }
  const linkData: CreativePayload["object_story_spec"]["link_data"] = {
    link: creative.destinationUrl,
    message: creative.primaryText,
    name: creative.headline,
    image_hash: creative.imageHash,
  };
  if (creative.description) linkData.description = creative.description;
  if (creative.ctaEnum) {
    // CTA link'i ana link ile aynı olmalı (SOURCES-B §4: "required to be the same as the CTA link url")
    linkData.call_to_action = { type: creative.ctaEnum, value: { link: creative.destinationUrl } };
  }
  const spec: CreativePayload["object_story_spec"] = { page_id: binding.pageId, link_data: linkData };
  if (binding.instagramActorId) spec.instagram_user_id = binding.instagramActorId;
  return { name: creativeName, object_story_spec: spec };
}

export type AdPayload = {
  name: string;
  adset_id: string;
  creative: { creative_id: string };
  status: typeof PAUSED_STATUS;
};

/** POST act_X/ads gövdesi (SOURCES-B §5). Not: Meta oluşan reklamı önce incelemeye
 *  alır (PENDING_REVIEW), sonra bizim seçtiğimiz PAUSED durumuna döner. */
export function buildAdPayload(input: { adName: string; adSetId: string; creativeId: string }): AdPayload {
  return {
    name: input.adName,
    adset_id: input.adSetId,
    creative: { creative_id: input.creativeId },
    status: PAUSED_STATUS,
  };
}

// ---------------------------------------------------------------------------
// Delivery estimate yorumu (SOURCES-B §9) — sayı ÜRETMEyiz, yalnız Meta'nınkini okuruz
// ---------------------------------------------------------------------------

export type OutcomeCurvePoint = {
  spend?: number;
  reach?: number;
  impressions?: number;
  actions?: number;
};

/** "Insufficient Data" tespiti: Meta yüksek güvenli tahmin veremediğinde
 *  daily_outcomes_curve ya hiç gelmez ya da "tek noktalı, hepsi 0" döner
 *  (SOURCES-B §9'daki resmî cümle). Her iki durum da yetersiz sayılır. */
export function isCurveInsufficient(curve: OutcomeCurvePoint[] | null | undefined): boolean {
  if (!curve || curve.length === 0) return true;
  if (curve.length === 1) {
    const p = curve[0];
    const values = [p.spend, p.reach, p.impressions, p.actions];
    if (values.every((v) => v == null || v === 0)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Ads Manager derin linkleri (sonuç ekranı — kullanıcı aktifleştirmeyi ORADA yapar)
// ---------------------------------------------------------------------------

function actNumeric(adAccountId: string): string {
  return adAccountId.replace(/^act_/, "");
}

export function adsManagerCampaignUrl(adAccountId: string, campaignId: string): string {
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actNumeric(adAccountId)}&selected_campaign_ids=${campaignId}`;
}

export function adsManagerAdSetUrl(adAccountId: string, adSetId: string): string {
  return `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${actNumeric(adAccountId)}&selected_adset_ids=${adSetId}`;
}

export function adsManagerAdUrl(adAccountId: string, adId: string): string {
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${actNumeric(adAccountId)}&selected_ad_ids=${adId}`;
}
