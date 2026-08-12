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

export const MARKET_CODES = MARKETS.map((m) => m.code);
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);
export const COPY_LANGUAGE_CODES = COPY_LANGUAGES.map((l) => l.code);
