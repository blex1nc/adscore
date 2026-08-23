// Hedef pazar kullanıcı tarafından seçilir (HANDOFF 21.5).
// Liste MVP başlangıcı; genişletilebilir.
export const MARKETS = [
  { code: "TR", label: "Türkiye" },
  { code: "DE", label: "Almanya" },
  { code: "GB", label: "Birleşik Krallık" },
  { code: "US", label: "ABD" },
  { code: "FR", label: "Fransa" },
  { code: "NL", label: "Hollanda" },
  { code: "ES", label: "İspanya" },
  { code: "IT", label: "İtalya" },
  { code: "AE", label: "BAE" },
  { code: "SA", label: "Suudi Arabistan" },
] as const;

export const CURRENCIES = [
  { code: "TRY", label: "TRY (₺)" },
  { code: "USD", label: "USD ($)" },
  { code: "EUR", label: "EUR (€)" },
  { code: "GBP", label: "GBP (£)" },
] as const;

export const COPY_LANGUAGES = [
  { code: "tr", label: "Türkçe" },
  { code: "en", label: "İngilizce" },
  { code: "de", label: "Almanca" },
  { code: "ar", label: "Arapça" },
] as const;

// CLAUDE.md §9 — rakip kategorileri
export const COMPETITOR_TYPE_LABELS: Record<string, string> = {
  DIRECT: "Doğrudan",
  INDIRECT: "Dolaylı",
  ASPIRATIONAL: "Aspirasyonel",
  CREATIVE: "Creative",
};

export const MARKET_CODES = MARKETS.map((m) => m.code);
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);
export const COPY_LANGUAGE_CODES = COPY_LANGUAGES.map((l) => l.code);

// Sprint 2026-08-23 (CONTRACTS §3) — Arena koşusu hedefleri ve döngü sınırları.
// Sınırlar kodda sabittir; form doğrulaması dışındaki değerleri reddeder.
export const CAMPAIGN_GOALS = ["sales", "traffic", "leads", "awareness"] as const;
export const EVOLUTION_LIMITS = {
  rounds: { min: 2, max: 8, default: 4 },
  population: { min: 4, max: 10, default: 6 },
  survivors: { min: 1, max: 3, default: 2 },
  judges: { min: 2, max: 4, default: 3 },
} as const;
