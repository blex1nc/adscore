// Ads Manager Kurulum Kiti v2 — tip sözleşmesi (docs/AGENT-B.md §3, CONTRACTS §4).
// Bu dosya saf tiptir: server-only / Prisma importu YOK (builder testleri node ile koşar).

export type KitConfidence = "low" | "medium" | "high";
export type KitSource = "plan" | "creative" | "brand" | "user_input";
export type KitRatio = "1x1" | "4x5" | "9x16";

export type KitField = {
  id: string; // "campaign.objective"
  label: string; // Ads Manager'daki etiket (dokümandan)
  adsManagerPath: string; // "Kampanya > Kampanya ayrıntıları > Hedef"
  value: string; // kopyalanacak değer; planda yoksa "" + gaps
  why?: string; // plandan
  confidence?: KitConfidence;
  alternative?: string;
  source: KitSource;
  // Ek (UI yardımcıları) — sözleşmeye uyumlu opsiyonel alanlar
  note?: string; // ör. "CTA eşleştirilemedi, elle seç"
  charLimit?: number; // kopya alanları için önerilen karakter sınırı (dokümandan)
  charLimitNote?: string; // sınırın kaynağı / türü ("önerilen", "maksimum")
  sourceUrl?: string; // alan etiketinin/limitin doğrulandığı resmi doküman
  inputKey?: string; // source === "user_input" ise KitInputs anahtarı
};

export type KitStep = { id: string; text: string };

export type KitSectionId = "campaign" | "adset" | "ad";

export type KitSection = {
  id: KitSectionId;
  title: string;
  fields: KitField[];
  steps: KitStep[];
};

export type KitAd = {
  creativeId: string;
  headline: string;
  primaryText: string;
  description: string | null;
  cta: string; // creative'deki ham CTA metni
  ctaButton: string | null; // Meta CTA enum eşlemesi (eşleşmezse null)
  ctaMatch: "exact" | "approximate" | "none";
  imageIds: string[];
};

export type KitAdset = {
  name: string;
  purpose: string;
  testVariable: string | null;
  ads: KitAd[];
};

export type KitBudget = {
  type: "DAILY" | "LIFETIME";
  amount: string;
  currency: string;
  durationDays: number | null;
  scenarios: unknown; // plandan (budget_plan.scenarios); AI bütçe belirlemez
};

export type KitAsset = { creativeImageId: string; ratios: KitRatio[] };

// Kullanıcının kit sayfasında doldurduğu alanlar (CONTRACTS/AGENT-B §3: Sayfa,
// Instagram, hedef URL, pixel/dataset, event). Kit JSON'u içinde saklanır.
export type KitInputs = {
  facebookPage?: string;
  instagramAccount?: string;
  destinationUrl?: string;
  pixelDataset?: string;
  conversionEvent?: string;
  adsManagerCampaignName?: string; // kullanıcı Ads Manager'da farklı ad verdiyse
};

export type Kit = {
  version: 1;
  generatedAt: string;
  disclaimer: string;
  sections: KitSection[]; // campaign → adset → ad
  adsets: KitAdset[];
  budget: KitBudget;
  assets: KitAsset[];
  gaps: string[];
  inputs: KitInputs;
  // Kaynak bilgisi: alan adları/limitler hangi dokümandan (CLAUDE.md §37)
  meta: { fieldsDoc: string; fieldsRetrievedAt: string };
};

// ---- Builder girdileri (Prisma modellerinin yapısal alt kümeleri) ----

export type PlanResultShape = {
  campaign_name?: string;
  objective?: {
    recommended?: string;
    key?: string; // yeni: awareness|traffic|engagement|leads|app_promotion|sales
    reason?: string;
    confidence?: string;
    alternative?: string | null;
  };
  special_ad_category?: {
    recommended?: string; // yeni: NONE | ... (dokümandaki API enum)
    reason?: string;
  };
  optimization_event?: {
    recommended?: string;
    reason?: string;
    pixel_condition?: string;
    conversion_location?: string; // yeni
    performance_goal?: string; // yeni
    event_name?: string; // yeni: Purchase | AddToCart | Lead ...
  };
  audience?: {
    suggestion?: {
      location?: string;
      locations?: string[]; // yeni
      age?: string;
      age_min?: number; // yeni
      age_max?: number; // yeni
      gender?: string;
      interests_behaviors?: string;
      detailed_targeting?: string[]; // yeni
      advantage_plus_note?: string;
      advantage_plus_audience?: boolean; // yeni
    };
    hypotheses?: Array<{ hypothesis?: string; confidence?: string }>;
  };
  placements?: {
    recommended?: string;
    reason?: string;
    confidence?: string;
    mode?: string; // yeni: advantage_plus | manual
    list?: string[]; // yeni: manuel ise yerleşim listesi
  };
  structure?: Array<{
    adset_name?: string;
    purpose?: string;
    creative_headlines?: string[];
    test_variable?: string | null;
  }>;
  budget_plan?: {
    level?: string; // yeni: campaign | adset
    scenarios?: Array<{ name?: string; allocation?: string; note?: string }>;
    disclaimer?: string;
  };
  manual_setup_steps?: string[];
  risks?: string[];
  data_gaps?: string[];
};

export type BuilderPlan = {
  id: string;
  status: string; // "COMPLETED" bekler
  goal: string;
  budgetType: "DAILY" | "LIFETIME";
  budgetAmount: string; // Decimal → string
  currency: string;
  durationDays: number | null;
  result: unknown; // PlanResultShape (toleranslı okunur)
};

export type BuilderCreative = {
  id: string;
  approval: string; // yalnız "APPROVED" kit'e girer
  headline: string;
  primaryText: string;
  description: string | null;
  cta: string;
  why?: string | null;
  confidence?: string | null;
  images: Array<{ id: string; status: string; hasData: boolean }>;
};

export type BuilderBrand = {
  name: string;
  website: string | null;
  currency: string | null;
  targetMarket: string | null;
  copyLanguage: string | null;
};

export type BuildKitInput = {
  plan: BuilderPlan;
  creatives: BuilderCreative[];
  brand: BuilderBrand;
  inputs?: KitInputs;
  now?: Date;
};
