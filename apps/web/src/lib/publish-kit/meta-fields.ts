// Ads Manager alan adları, yolları, listeleri ve limitleri — HAFIZADAN DEĞİL,
// docs/META-ADS-MANAGER-FIELDS.md'deki resmi kaynaklardan (her sabitin yanında URL).
// Türkçe etiketler yalnız Meta'nın tr_TR sayfalarından; tr_TR kaynağı yoksa EN kullanılır.
// Saf modül: server-only / Prisma importu yok (builder testleri node ile koşar).

import type { KitRatio, KitSectionId } from "./types";

export const META_FIELDS_DOC = "docs/META-ADS-MANAGER-FIELDS.md";
export const META_FIELDS_RETRIEVED_AT = "2026-08-23";

const HC = "https://www.facebook.com/business/help/";
const API = "https://developers.facebook.com/docs/marketing-api/reference/";

// Kaynaklar (kısaltma → URL)
export const SRC = {
  objectives: `${HC}1438417719786914`, // Choosing objectives (en_US + tr_TR)
  levels: `${HC}621956575422138`, // Campaign / ad set / ad levels (tr_TR)
  createCampaign: `${HC}1658289035439772`, // Create a campaign (en_US; tr yok)
  editCampaign: `${HC}2169779963333459`, // Edit campaign/ad set/ad (tr_TR)
  createAd: `${HC}1006187918591258`, // Create an ad (en_US; tr yok)
  advantageAudience: `${HC}273363992030035`, // Advantage+ audience (tr_TR)
  advantageAudienceSetup: `${HC}793748385630490`, // Advantage+ audience setup (tr_TR)
  acb: `${HC}153514848493595`, // Advantage+ campaign budget (tr_TR)
  specialAdCategory: `${HC}298000447747885`, // Special ad categories (tr_TR)
  conversionLocations: `${HC}2035196646663270`, // Conversion locations & events by objective (en_US + tr_TR)
  performanceGoals: `${HC}416997652473726`, // Performance goals by objective & location (en_US + tr_TR)
  choosePlacements: `${HC}175741192481247`, // Choose ad placements (en_US + tr_TR)
  placementsList: `${HC}407108559393196`, // Ad placements across Meta technologies (en_US + tr_TR)
  ageTargeting: "https://en-gb.facebook.com/business/help/103928676365132", // Age targeting (13 – 65+)
  textBestPractices: `${HC}223409425500940`, // Text length recommendations (tr_TR)
  minPixels: `${HC}469767027114079`, // Recommended minimum image pixel size
  aspectRatios: `${HC}103816146375741`, // Aspect ratio recommendations by placement
  bulkFieldNames: `${HC}1462433740708893`, // Ads Manager field names ↔ spreadsheet columns (tr_TR)
  bulkColumns: `${HC}1471948569691450`, // Columns in the import/export template (tr_TR)
  adsGuideFbFeed: "https://www.facebook.com/business/ads-guide/image/facebook-feed",
  adsGuideIgStory: "https://www.facebook.com/business/ads-guide/update/image/instagram-story",
  apiCampaign: `${API}ad-campaign-group/`,
  apiAdset: `${API}ad-campaign/`,
  apiPromotedObject: `${API}ad-promoted-object/`,
  apiCta: `${API}ad-creative-link-data-call-to-action/`,
} as const;

export type FieldDef = { label: string; path: string; sourceUrl: string };

export const SECTION_TITLES: Record<KitSectionId, string> = {
  campaign: "Kampanya", // tr_TR: "kampanya, reklam seti ve reklam" (levels)
  adset: "Reklam seti",
  ad: "Reklam",
};

// Alan tanımları: etiket + Ads Manager yolu (tr_TR kaynağı olan etiketler Türkçe)
export const FIELD_DEFS: Record<string, FieldDef> = {
  "campaign.objective": {
    label: "Reklam verme amacı",
    path: "Kampanya > Reklam verme amacı (6 basitleştirilmiş amaç)",
    sourceUrl: SRC.objectives,
  },
  "campaign.name": {
    label: "Kampanya adı",
    path: "Kampanya > Kampanya adı",
    sourceUrl: SRC.editCampaign,
  },
  "campaign.special_ad_category": {
    label: "Özel Reklam Kategorileri",
    path: "Kampanya > Özel Reklam Kategorileri > Kategoriler",
    sourceUrl: SRC.specialAdCategory,
  },
  "campaign.budget": {
    label: "Advantage+ kampanya bütçesi",
    path: "Kampanya > Bütçe (Kampanya bütçesi / Reklam seti bütçesi)",
    sourceUrl: SRC.acb,
  },
  "adset.name": {
    label: "Reklam seti adı",
    path: "Reklam seti > Reklam seti adı",
    sourceUrl: SRC.editCampaign,
  },
  "adset.conversion_location": {
    label: "Dönüşüm konumu",
    path: "Reklam seti > Dönüşüm konumu (yayından sonra düzenlenemez)",
    sourceUrl: SRC.conversionLocations,
  },
  "adset.performance_goal": {
    label: "Performans hedefi",
    path: "Reklam seti > Performans hedefi (amaca ve dönüşüm konumuna göre liste)",
    sourceUrl: SRC.performanceGoals,
  },
  "adset.pixel": {
    label: "Piksel / veri seti",
    path: "Reklam seti > dönüşüm konumu 'İnternet sitesi' seçilince — bölüm etiketi dokümanda mevcut değil",
    sourceUrl: SRC.apiPromotedObject,
  },
  "adset.conversion_event": {
    label: "Dönüşüm olayı",
    path: "Reklam seti > Dönüşüm olayı (dönüşüm konumuna göre liste)",
    sourceUrl: SRC.conversionLocations,
  },
  "adset.budget_schedule": {
    label: "Bütçe ve plan",
    path: "Reklam seti > Bütçe ve plan > Bütçe",
    sourceUrl: SRC.editCampaign,
  },
  "adset.schedule": {
    label: "Plan",
    path: "Reklam seti > Bütçe ve plan > Plan (başlangıç / bitiş)",
    sourceUrl: SRC.levels,
  },
  "adset.locations": {
    label: "Konumlar",
    path: "Reklam seti > Hedef kitle > Hedef kitle kontrolleri > Konumlar",
    sourceUrl: SRC.advantageAudienceSetup,
  },
  "adset.age": {
    label: "Yaş",
    path: "Reklam seti > Hedef kitle > Hedef kitle önerisi > Yaş",
    sourceUrl: SRC.advantageAudienceSetup,
  },
  "adset.gender": {
    label: "Cinsiyet",
    path: "Reklam seti > Hedef kitle > Hedef kitle önerisi > Cinsiyet",
    sourceUrl: SRC.advantageAudienceSetup,
  },
  "adset.detailed_targeting": {
    label: "Detaylı hedefleme",
    path: "Reklam seti > Hedef kitle > Hedef kitle önerisi > Detaylı hedefleme",
    sourceUrl: SRC.advantageAudienceSetup,
  },
  "adset.advantage_plus_audience": {
    label: "Advantage+ hedef kitlesi",
    path: "Reklam seti > Hedef kitle > Advantage+ hedef kitlesi (açık/kapalı)",
    sourceUrl: SRC.advantageAudience,
  },
  "adset.placements": {
    label: "Reklam alanları",
    path: "Reklam seti > Reklam Alanları (Advantage+ reklam alanları varsayılan; Düzenle > Manuel reklam alanları)",
    sourceUrl: SRC.choosePlacements,
  },
  "ad.identity.page": {
    label: "Facebook Sayfası",
    path: "Reklam > Kimlik > Facebook Sayfası",
    sourceUrl: SRC.editCampaign,
  },
  "ad.identity.instagram": {
    label: "Instagram hesabı",
    path: "Reklam > Kimlik > Instagram hesabı",
    sourceUrl: SRC.levels,
  },
  "ad.name": {
    label: "Reklam adı",
    path: "Reklam > Reklam adı",
    sourceUrl: SRC.editCampaign,
  },
  "ad.format": {
    label: "Reklam formatı",
    path: "Reklam > Reklam kurulumu > Reklam formatı",
    sourceUrl: SRC.levels,
  },
  "ad.primary_text": {
    label: "Ana metin",
    path: "Reklam > Reklam kreatifi > Ana metin",
    sourceUrl: SRC.textBestPractices,
  },
  "ad.headline": {
    label: "Başlık",
    path: "Reklam > Reklam kreatifi > Başlık",
    sourceUrl: SRC.textBestPractices,
  },
  "ad.description": {
    label: "Açıklama",
    path: "Reklam > Reklam kreatifi > Açıklama",
    sourceUrl: SRC.textBestPractices,
  },
  "ad.cta": {
    label: "Eylem çağrısı",
    path: "Reklam > Reklam kreatifi > Eylem çağrısı (buton)",
    sourceUrl: SRC.bulkFieldNames,
  },
  "ad.destination_url": {
    label: "Site adresi (URL)",
    path: "Reklam > Site adresi (URL) — bölüm başlığı dokümanda mevcut değil",
    sourceUrl: SRC.bulkFieldNames,
  },
  "ad.tracking": {
    label: "Piksel (izleme)",
    path: "Reklam düzeyi — izleme bölümünün adı dokümanda mevcut değil",
    sourceUrl: SRC.apiPromotedObject,
  },
};

// Ads Manager'ın 6 basitleştirilmiş amacı (EN/TR etiketleri tr_TR + en_US sayfalarından;
// API OUTCOME_* enum'u ad-campaign-group referansından). "matchers": serbest plan
// metnini eşlemek için normalize edilmiş anahtarlar (bizim eşleme mantığımız).
export const OBJECTIVES = [
  { key: "awareness", apiEnum: "OUTCOME_AWARENESS", labelEn: "Awareness", labelTr: "Bilinirlik", sheetLabel: "Awareness", matchers: ["awareness", "bilinirlik", "outcome awareness", "brand awareness", "reach"] },
  { key: "traffic", apiEnum: "OUTCOME_TRAFFIC", labelEn: "Traffic", labelTr: "Trafik", sheetLabel: "Traffic", matchers: ["traffic", "trafik", "outcome traffic", "link clicks"] },
  { key: "engagement", apiEnum: "OUTCOME_ENGAGEMENT", labelEn: "Engagement", labelTr: "Etkileşim", sheetLabel: "Engagement", matchers: ["engagement", "etkilesim", "outcome engagement"] },
  { key: "leads", apiEnum: "OUTCOME_LEADS", labelEn: "Leads", labelTr: "Potansiyel müşteriler", sheetLabel: "Leads", matchers: ["leads", "lead", "potansiyel musteri", "potansiyel musteriler", "outcome leads", "lead generation"] },
  { key: "app_promotion", apiEnum: "OUTCOME_APP_PROMOTION", labelEn: "App promotion", labelTr: "Uygulama tanıtımı", sheetLabel: "App promotion", matchers: ["app promotion", "uygulama tanitimi", "outcome app promotion", "app installs"] },
  { key: "sales", apiEnum: "OUTCOME_SALES", labelEn: "Sales", labelTr: "Satışlar", sheetLabel: "Sales", matchers: ["sales", "satis", "satislar", "outcome sales", "conversions", "donusum"] },
] as const;
export const OBJECTIVES_SOURCE = { ui: SRC.objectives, api: SRC.apiCampaign, sheet: SRC.bulkColumns };

// special_ad_categories API enum (ad-campaign-group); UI etiketleri Help Center 298000447747885
export const SPECIAL_AD_CATEGORIES = [
  { apiEnum: "NONE", labelEn: "None", labelTr: "Yok" },
  { apiEnum: "CREDIT", labelEn: "Financial products and services (credit)", labelTr: "" },
  { apiEnum: "FINANCIAL_PRODUCTS_SERVICES", labelEn: "Financial products and services", labelTr: "" },
  { apiEnum: "EMPLOYMENT", labelEn: "Employment", labelTr: "" },
  { apiEnum: "HOUSING", labelEn: "Housing", labelTr: "" },
  { apiEnum: "ISSUES_ELECTIONS_POLITICS", labelEn: "Social issues, elections or politics", labelTr: "" },
  { apiEnum: "ONLINE_GAMBLING_AND_GAMING", labelEn: "Online gambling and gaming", labelTr: "" },
] as const;

// Help Center 175741192481247 (en_US + tr_TR): "Advantage+ placements is selected by default … Select Manual placements"
export const PLACEMENT_MODES = {
  advantage_plus: { labelEn: "Advantage+ placements", labelTr: "Advantage+ reklam alanları" },
  manual: { labelEn: "Manual placements", labelTr: "Manuel reklam alanları" },
} as const;

// Satışlar amacı için dönüşüm konumları / event'ler / performans hedefleri (Help Center
// 2035196646663270 ve 416997652473726, en_US + tr_TR) — plan promptu ve kit notları için.
export const SALES_CONVERSION_LOCATIONS_TR = ["İnternet sitesi", "Uygulama", "İnternet sitesi ve uygulama", "İnternet sitesi ve mağaza içi", "İnternet sitesi ve aramalar", "Messenger", "WhatsApp"] as const;
export const SALES_PERFORMANCE_GOALS_WEBSITE_TR = [
  "Dönüşüm sayısının en üst seviyeye çıkarılması",
  "Dönüşümlerin değerinin en üst seviyeye çıkarılması",
  "Yönlendirme sayfası görüntülemelerinin sayısının en üst seviyeye çıkarılması",
  "Bağlantı tıklamalarının sayısının en üst seviyeye çıkarılması",
  "Günlük tekil erişimin en üst seviyeye çıkarılması",
  "Gösterim sayısını en üst seviyeye çıkarın",
] as const;
// Yaş sınırları (Help Center 103928676365132): minimum 13, maksimum tanımlanabilir 65+
export const AGE_LIMITS = { min: 13, maxLabel: "65+" } as const;

// Cinsiyet seçenekleri: plan "all|men|women" anahtarı ya da serbest metin (matchers)
export const GENDER_OPTIONS = [
  { key: "all", label: "Tüm cinsiyetler", matchers: ["all", "tum", "tumu", "hepsi", "tum cinsiyetler", "kadin erkek", "erkek kadin"] },
  { key: "men", label: "Erkekler", matchers: ["men", "male", "erkek", "erkekler"] },
  { key: "women", label: "Kadınlar", matchers: ["women", "female", "kadin", "kadinlar"] },
] as const;

// CTA butonları: API enum (ad-creative-link-data-call-to-action). UI etiketleri yalnız
// resmi eşleme sayfasında (1462433740708893, en_US + tr_TR) verilen 7 buton için;
// diğerlerinde etiket = enum (uydurulmadı). "synonyms": creative'deki serbest TR/EN
// CTA metnini en yakın butona götüren bizim eşleme listemiz → "yaklaşık, doğrula".
export type CtaButton = { apiEnum: string; labelEn: string; labelTr?: string; synonyms: string[] };
export const CTA_BUTTONS: CtaButton[] = [
  { apiEnum: "SHOP_NOW", labelEn: "Shop now", labelTr: "Şimdi alışveriş yap", synonyms: ["alisverise basla", "hemen alisveris yap", "alisveris yap", "hemen satin al", "satin al", "simdi satin al", "hemen al", "shop"] },
  { apiEnum: "LEARN_MORE", labelEn: "Learn more", labelTr: "Daha fazla bilgi", synonyms: ["daha fazla bilgi al", "daha fazla bilgi edin", "hemen kesfet", "kesfet", "simdi kesfet", "daha fazlasini kesfet", "incele", "hemen incele", "detaylari incele", "bilgi al"] },
  { apiEnum: "SIGN_UP", labelEn: "Sign up", labelTr: "Kaydol", synonyms: ["kayit ol", "hemen kaydol", "simdi kaydol", "uye ol"] },
  { apiEnum: "DOWNLOAD", labelEn: "Download", labelTr: "İndir", synonyms: ["hemen indir", "simdi indir", "uygulamayi indir"] },
  { apiEnum: "BOOK_TRAVEL", labelEn: "Book now", labelTr: "Şimdi rezervasyon yap", synonyms: ["rezervasyon yap", "hemen rezervasyon yap", "yer ayirt"] },
  // SEE_DETAILS: API enum listesinde yok; yalnız içe aktarma sütun eşlemesinde (1462433740708893)
  { apiEnum: "SEE_DETAILS", labelEn: "See details", labelTr: "Detayları gör", synonyms: ["detaylari gor", "detaylar", "ayrintilari gor"] },
  { apiEnum: "WATCH_MORE", labelEn: "Watch more", labelTr: "Daha fazla izle", synonyms: ["izle", "hemen izle", "videoyu izle"] },
  { apiEnum: "ORDER_NOW", labelEn: "ORDER_NOW", synonyms: ["siparis ver", "simdi siparis ver", "hemen siparis ver", "siparis et"] },
  { apiEnum: "BUY_NOW", labelEn: "BUY_NOW", synonyms: ["buy now"] },
  { apiEnum: "GET_OFFER", labelEn: "GET_OFFER", synonyms: ["teklifi al", "teklif al", "firsati yakala", "indirimi al"] },
  { apiEnum: "CONTACT_US", labelEn: "CONTACT_US", synonyms: ["bize ulasin", "iletisime gec", "bizimle iletisime gecin"] },
  { apiEnum: "SUBSCRIBE", labelEn: "SUBSCRIBE", synonyms: ["abone ol", "hemen abone ol"] },
  { apiEnum: "APPLY_NOW", labelEn: "APPLY_NOW", synonyms: ["hemen basvur", "basvur", "simdi basvur"] },
  { apiEnum: "GET_QUOTE", labelEn: "GET_QUOTE", synonyms: ["teklif iste", "fiyat al", "fiyat teklifi al"] },
  { apiEnum: "MESSAGE_PAGE", labelEn: "MESSAGE_PAGE", synonyms: ["mesaj gonder", "mesaj at"] },
  { apiEnum: "WHATSAPP_MESSAGE", labelEn: "WHATSAPP_MESSAGE", synonyms: ["whatsapp", "whatsapp tan yaz", "whatsapptan yaz"] },
  { apiEnum: "VIEW_PRODUCT", labelEn: "VIEW_PRODUCT", synonyms: ["urunu gor", "urunu incele", "urunleri gor"] },
  { apiEnum: "GET_STARTED", labelEn: "GET_STARTED", synonyms: ["hemen basla", "basla", "simdi basla"] },
  { apiEnum: "TRY_DEMO", labelEn: "TRY_DEMO", synonyms: ["demoyu dene", "ucretsiz dene", "dene"] },
  { apiEnum: "BOOK_NOW", labelEn: "BOOK_NOW", synonyms: ["randevu al", "hemen randevu al"] },
  { apiEnum: "NO_BUTTON", labelEn: "NO_BUTTON", synonyms: ["buton yok", "butonsuz"] },
];
// Toplu içe aktarma "Call to action" sütununda dokümante edilen değerler (1462433740708893)
export const SHEET_CTA_VALUES = ["BOOK_TRAVEL", "DOWNLOAD", "LEARN_MORE", "SEE_DETAILS", "SHOP_NOW", "SIGN_UP", "WATCH_MORE"] as const;

// Kopya uzunluğu: Help Center 223409425500940 — "çoğu reklam alanı için TAVSİYE EDİLEN
// metin uzunluğu: Ana metin 125, Başlık 40, Açıklama 25 karakter". Sert üst sınır
// resmi sayfalarda sayı olarak yok → yalnız "önerilen" gösterilir.
export const COPY_LIMITS = {
  primaryText: { limit: 125, note: "çoğu reklam alanı için önerilen", sourceUrl: SRC.textBestPractices },
  headline: { limit: 40, note: "çoğu reklam alanı için önerilen", sourceUrl: SRC.textBestPractices },
  description: { limit: 25, note: "çoğu reklam alanı için önerilen", sourceUrl: SRC.textBestPractices },
} as const;

// Görsel boyutları (piksel): Help Center 469767027114079 "Facebook Feed: 1:1 → 1080×1080,
// 4:5 → 1440×1800"; Ads Guide Instagram Story (image): "9:16 → 1440×2560".
// Hepsi resmi; estimate=false.
export const IMAGE_SPECS: Record<KitRatio, { width: number; height: number; placements: string; sourceUrl: string; estimate: boolean }> = {
  "1x1": { width: 1080, height: 1080, placements: "Akış (Feed) — kare", sourceUrl: SRC.minPixels, estimate: false },
  "4x5": { width: 1440, height: 1800, placements: "Akış (Feed) — dikey", sourceUrl: SRC.minPixels, estimate: false },
  "9x16": { width: 1440, height: 2560, placements: "Hikâye / Reels", sourceUrl: SRC.adsGuideIgStory, estimate: false },
};

// Reklam formatı seçenekleri (levels, tr_TR: "Tek görsel veya video, döngü ... ya da koleksiyon")
export const AD_FORMATS = {
  single: { labelEn: "Single image or video", labelTr: "Tek görsel veya video" },
  carousel: { labelEn: "Carousel", labelTr: "Döngü" },
  collection: { labelEn: "Collection", labelTr: "Koleksiyon" },
} as const;
