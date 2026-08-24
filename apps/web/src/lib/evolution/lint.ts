// ARENA — deterministik lint (AGENT-A §4). SAF FONKSİYON: AI yok, DB yok,
// server-only yok (node --test ile test edilir). Her kural { rule, severity, message }
// üretir; "hard" ihlal adayı eler (jüriye gitmez), "soft" ihlal puan düşürür.
//
// Kırmızı çizgiler (CLAUDE.md §6/§31): teklif yalnız kullanıcı verdiyse kullanılır;
// rakip adı geçmez; araştırma/ürün verisinde olmayan sayısal iddia yazılmaz.

export type LintSeverity = "hard" | "soft";

export type LintIssue = {
  rule: LintRule;
  severity: LintSeverity;
  message: string;
};

export type LintRule =
  | "offer_without_permission"
  | "competitor_name"
  | "unsupported_number"
  | "hook_late"
  | "headline_long"
  | "primary_too_long"
  | "cta_unknown"
  | "duplicate_sibling"
  | "language_mismatch";

export type LintCandidateInput = {
  id: string;
  hook: string;
  primaryText: string;
  headline: string;
  description?: string | null;
  cta: string;
};

export type LintContext = {
  /** Kullanıcının verdiği gerçek teklif; null ise copy'de teklif/indirim YASAK */
  offer: string | null;
  /** Markanın Competitor kayıtlarındaki isimler */
  competitorNames: string[];
  /** Brand.copyLanguage (BCP 47, ör. "tr") */
  copyLanguage: string | null;
  /**
   * Sayısal iddiaların doğrulanabileceği kaynak metinler: araştırma JSON'u,
   * ürün listesi, marka açıklaması, teklif, yönlendirme. Burada geçmeyen sayı
   * desteklenmemiş sayılır.
   */
  sourceTexts: string[];
};

export type LintResult = {
  /** 0-100; 100 − Σ ceza (hard ihlal: HARD_PENALTY) */
  score: number;
  issues: LintIssue[];
  eliminated: boolean;
  eliminatedReason: string | null;
};

// ---- Sabitler (AGENT-A §4 tablosu) ----
export const SOFT_PENALTIES: Record<
  Exclude<
    LintRule,
    "offer_without_permission" | "competitor_name" | "unsupported_number"
  >,
  number
> = {
  hook_late: 15,
  headline_long: 10,
  primary_too_long: 10,
  cta_unknown: 5,
  duplicate_sibling: 20,
  language_mismatch: 10,
};
export const HARD_PENALTY = 50;
export const HOOK_WINDOW_CHARS = 125;
export const HEADLINE_MAX_CHARS = 40;
export const PRIMARY_MAX_CHARS = 600;
export const CTA_MAX_WORDS = 4;
export const DUPLICATE_JACCARD_THRESHOLD = 0.6;
/** Bu değerden küçük çıplak sayılar (iddia kelimesi yoksa) sayısal iddia sayılmaz: "2 adımda", "1 fincan" */
export const BARE_NUMBER_CLAIM_MIN = 10;

// Teklif/indirim kalıpları — kelime BAŞI eşleşir (TR ekleri: indirimli, ücretsizdir, kampanyalı...)
export const OFFER_WORDS_TR = [
  "indirim",
  "ücretsiz",
  "bedava",
  "kampanya",
  "fırsat",
  "hediye",
  "kupon",
  "promosyon",
] as const;
export const OFFER_WORDS_EN = [
  "discount",
  "free",
  "sale",
  "coupon",
  "promo",
  "deal",
  "giveaway",
] as const;
const OFFER_PATTERNS: RegExp[] = [
  /%\s?\d/u, // %20
  /\d\s?%/u, // 20%
  /\d[\d.,]*\s?(tl|₺|\$|€|£|usd|eur|try|gbp)(?![\p{L}])/iu, // 199 TL, 19.99$
  /[₺$€£]\s?\d/u, // ₺199
  /\d+\s?%?\s?off(?![\p{L}])/iu, // 20% off, 20 off
  /\b\d+\s?(al|buy)\s?\d+\s?(öde|pay|get)\b/iu, // 2 al 1 öde
];

// Sayı + iddia kelimesi: küçük sayılarda da iddia sayılır ("5 yıldız", "3 ülke")
const CLAIM_WORD_AFTER_NUMBER =
  /^\s*(\+|\.)?\s*(yıl|yil|yıllık|müşteri|musteri|kişi|kisi|yıldız|yildiz|puan|kez|kat|ülke|ulke|şehir|sehir|mağaza|magaza|adet|ton|kg|gram|ml|litre|saat|dakika|dk|gün|gun|hafta|ay|ödül|odul|customer|client|year|star|review|rating|people|countr|cit|store|hour|minute|day|week|month|award)/iu;
// Kelimeyle yazılmış çokluk iddiaları
const WORD_QUANTITY_CLAIMS =
  /(binlerce|milyonlarca|yüzlerce|on binlerce|thousands of|millions of|hundreds of)/iu;

// ---- Yardımcılar ----
const LOCALE = "tr";

export function normalizeText(text: string): string {
  return (text ?? "")
    .toLocaleLowerCase(LOCALE)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((t) => t.length >= 3),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Kelime başı eşleşme (öncesinde harf/rakam yok); sonrasına TR eki gelebilir */
function wordStartRegex(word: string): RegExp {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(word)}`, "iu");
}

function normalizeNumber(raw: string): string {
  return raw.replace(/[.,\s]/g, "");
}

const NUMBER_RE = /\d+(?:[.,]\d+)*/gu;

function allowedNumberSet(sourceTexts: string[]): Set<string> {
  const set = new Set<string>();
  for (const src of sourceTexts) {
    if (!src) continue;
    for (const m of src.matchAll(NUMBER_RE)) set.add(normalizeNumber(m[0]));
  }
  return set;
}

function candidateCopy(c: LintCandidateInput): string {
  return [c.primaryText, c.headline, c.description ?? ""].join("\n");
}

// ---- Kurallar ----

function checkOffer(copy: string, ctx: LintContext): LintIssue | null {
  if (ctx.offer && ctx.offer.trim().length > 0) return null;
  const lower = copy.toLocaleLowerCase(LOCALE);
  for (const w of OFFER_WORDS_TR) {
    if (wordStartRegex(w).test(lower)) {
      return {
        rule: "offer_without_permission",
        severity: "hard",
        message: `Teklif verilmeden indirim/kampanya ifadesi: "${w}"`,
      };
    }
  }
  for (const w of OFFER_WORDS_EN) {
    if (new RegExp(`\\b${escapeRegExp(w)}s?\\b`, "iu").test(lower)) {
      return {
        rule: "offer_without_permission",
        severity: "hard",
        message: `Teklif verilmeden indirim/kampanya ifadesi: "${w}"`,
      };
    }
  }
  for (const re of OFFER_PATTERNS) {
    const m = lower.match(re);
    if (m) {
      return {
        rule: "offer_without_permission",
        severity: "hard",
        message: `Teklif verilmeden fiyat/yüzde kalıbı: "${m[0].trim()}"`,
      };
    }
  }
  return null;
}

function checkCompetitor(copy: string, ctx: LintContext): LintIssue | null {
  const lower = copy.toLocaleLowerCase(LOCALE);
  for (const name of ctx.competitorNames) {
    const n = name.trim().toLocaleLowerCase(LOCALE);
    if (n.length < 3) continue;
    if (wordStartRegex(n).test(lower)) {
      return {
        rule: "competitor_name",
        severity: "hard",
        message: `Rakip adı geçiyor: "${name.trim()}"`,
      };
    }
  }
  return null;
}

function checkNumbers(copy: string, ctx: LintContext): LintIssue | null {
  const allowed = allowedNumberSet(ctx.sourceTexts);
  const sourceLower = ctx.sourceTexts
    .join("\n")
    .toLocaleLowerCase(LOCALE);
  for (const m of copy.matchAll(NUMBER_RE)) {
    const raw = m[0];
    const norm = normalizeNumber(raw);
    if (allowed.has(norm)) continue;
    const after = copy.slice((m.index ?? 0) + raw.length);
    const before = copy.slice(0, m.index ?? 0);
    const hasUnit =
      /[%₺$€£]\s*$/.test(before) ||
      /^\s*[%₺$€£]/.test(after) ||
      /^\s*(tl|usd|eur|try|gbp)(?![\p{L}])/iu.test(after) ||
      CLAIM_WORD_AFTER_NUMBER.test(after);
    const value = Number(norm);
    if (!hasUnit && Number.isFinite(value) && value < BARE_NUMBER_CLAIM_MIN) {
      continue;
    }
    return {
      rule: "unsupported_number",
      severity: "hard",
      message: `Desteklenmeyen sayısal iddia: "${raw}" araştırma/ürün verisinde yok.`,
    };
  }
  const wordClaim = copy.match(WORD_QUANTITY_CLAIMS);
  if (wordClaim && !sourceLower.includes(wordClaim[0].toLocaleLowerCase(LOCALE))) {
    return {
      rule: "unsupported_number",
      severity: "hard",
      message: `Desteklenmeyen çokluk iddiası: "${wordClaim[0]}"`,
    };
  }
  return null;
}

function checkHookLate(c: LintCandidateInput): LintIssue | null {
  const hook = normalizeText(c.hook);
  if (!hook) {
    return {
      rule: "hook_late",
      severity: "soft",
      message: "Hook boş.",
    };
  }
  const key = hook.length > 30 ? hook.slice(0, 30) : hook;
  const idx = normalizeText(c.primaryText).indexOf(key);
  if (idx === -1 || idx > HOOK_WINDOW_CHARS) {
    return {
      rule: "hook_late",
      severity: "soft",
      message:
        idx === -1
          ? "Hook primary text'te geçmiyor."
          : `Hook ilk ${HOOK_WINDOW_CHARS} karakterde değil (konum ${idx}).`,
    };
  }
  return null;
}

function checkLanguage(c: LintCandidateInput, ctx: LintContext): LintIssue | null {
  const lang = (ctx.copyLanguage ?? "").toLowerCase();
  const text = `${c.primaryText} ${c.headline}`;
  const hasTurkishChars = /[çğıöşüÇĞİÖŞÜ]/u.test(text);
  if (lang === "tr" && text.length >= 40 && !hasTurkishChars) {
    return {
      rule: "language_mismatch",
      severity: "soft",
      message: "Copy dili tr ama metinde Türkçe karakter yok.",
    };
  }
  if (lang === "en" && hasTurkishChars) {
    return {
      rule: "language_mismatch",
      severity: "soft",
      message: "Copy dili en ama metinde Türkçe karakter var.",
    };
  }
  return null;
}

// ---- Ana giriş ----

export function lintCandidate(
  c: LintCandidateInput,
  ctx: LintContext,
  siblings: LintCandidateInput[] = [],
): LintResult {
  const issues: LintIssue[] = [];
  const copy = candidateCopy(c);

  const offer = checkOffer(copy, ctx);
  if (offer) issues.push(offer);
  const competitor = checkCompetitor(copy, ctx);
  if (competitor) issues.push(competitor);
  const number = checkNumbers(copy, ctx);
  if (number) issues.push(number);

  const hookLate = checkHookLate(c);
  if (hookLate) issues.push(hookLate);
  if (c.headline.trim().length > HEADLINE_MAX_CHARS) {
    issues.push({
      rule: "headline_long",
      severity: "soft",
      message: `Başlık ${c.headline.trim().length} karakter (> ${HEADLINE_MAX_CHARS}).`,
    });
  }
  if (c.primaryText.length > PRIMARY_MAX_CHARS) {
    issues.push({
      rule: "primary_too_long",
      severity: "soft",
      message: `Primary text ${c.primaryText.length} karakter (> ${PRIMARY_MAX_CHARS}).`,
    });
  }
  const ctaWords = c.cta.trim().split(/\s+/).filter(Boolean);
  if (ctaWords.length === 0 || ctaWords.length > CTA_MAX_WORDS) {
    issues.push({
      rule: "cta_unknown",
      severity: "soft",
      message:
        ctaWords.length === 0
          ? "CTA boş."
          : `CTA ${ctaWords.length} kelime (> ${CTA_MAX_WORDS}).`,
    });
  }
  const mine = tokenize(`${c.primaryText} ${c.headline}`);
  for (const s of siblings) {
    if (s.id === c.id) continue;
    const sim = jaccard(mine, tokenize(`${s.primaryText} ${s.headline}`));
    if (sim > DUPLICATE_JACCARD_THRESHOLD) {
      issues.push({
        rule: "duplicate_sibling",
        severity: "soft",
        message: `Aynı turdaki başka adaya çok benziyor (Jaccard ${sim.toFixed(2)}).`,
      });
      break;
    }
  }
  const lang = checkLanguage(c, ctx);
  if (lang) issues.push(lang);

  let penalty = 0;
  for (const i of issues) {
    penalty +=
      i.severity === "hard"
        ? HARD_PENALTY
        : SOFT_PENALTIES[i.rule as keyof typeof SOFT_PENALTIES];
  }
  const hard = issues.filter((i) => i.severity === "hard");
  return {
    score: Math.max(0, Math.min(100, 100 - penalty)),
    issues,
    eliminated: hard.length > 0,
    eliminatedReason: hard.length > 0 ? hard.map((h) => h.message).join(" · ") : null,
  };
}

/** Turun tüm adaylarını birlikte lint'ler (duplicate_sibling için kardeşler gerekir). */
export function lintCandidates(
  candidates: LintCandidateInput[],
  ctx: LintContext,
): Map<string, LintResult> {
  const out = new Map<string, LintResult>();
  for (const c of candidates) out.set(c.id, lintCandidate(c, ctx, candidates));
  return out;
}

/** Lint geri bildirimi: yeniden üretimde modele "bunlardan kaçın" listesi */
export function summarizeLintFeedback(
  results: Iterable<Pick<LintResult, "issues">>,
): string[] {
  const seen = new Set<string>();
  for (const r of results) {
    for (const i of r.issues) {
      if (i.severity === "hard") seen.add(`${i.rule}: ${i.message}`);
    }
  }
  return [...seen];
}
