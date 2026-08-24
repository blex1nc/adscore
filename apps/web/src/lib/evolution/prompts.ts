import "server-only";
import { JUDGE_DIMENSIONS, type JudgePersona } from "./select";
import {
  CROSSOVER_OPERATOR,
  GOAL_LABELS,
  MUTATION_OPERATORS,
  STRATEGY_AXES,
} from "./constants";
import { OFFER_WORDS_EN, OFFER_WORDS_TR } from "./lint";

// Lint'teki yasaklı kelime listesiyle AYNI kaynaktan türetilir; modele önceden söylenir
// ki adaylar kural kontrolünde boşuna elenmesin.
const OFFER_WORDS_TR_EN_NOTE = `Teklif yokken şu kelimeler/kalıplar YASAK: ${[...OFFER_WORDS_TR, ...OFFER_WORDS_EN].map((w) => `"${w}"`).join(", ")}, yüzde (%), fiyat/para birimi (TL, ₺, $, €).`;

// ---------------------------------------------------------------------------
// ÜRETİM (GENERATE) — lib/creatives/prompts.ts kuralları AYNEN miras alınır
// (o dosya Ajan A'nın değil; import yerine metin tekrarı — CONTRACTS §5).
// CLAUDE.md §14/§15 — pattern'ler markaya uyarlanır; kopya üretilmez.
// CLAUDE.md §6/§31 — doğrulanmamış iddia, uydurma indirim/fiyat/istatistik yasak.
// ---------------------------------------------------------------------------
export const ARENA_GENERATE_SYSTEM_PROMPT = `Sen kıdemli bir performans reklam yazarısın. Görevin, verilen marka profili ve pazar pattern'lerinden yola çıkarak Meta reklamları için markaya özel copy adayları üretmek. Bu adaylar bir seçilim arenasında (deterministik kurallar + AI jüri paneli) birbirleriyle yarışacak.

Kesin kurallar:
1. YALNIZCA verilen marka/araştırma bilgilerini kullan. Doğrulanmamış iddia, uydurma indirim, fiyat, yüzde, istatistik, ödül veya müşteri sayısı YAZMA. Araştırma/ürün verisinde geçmeyen HİÇBİR sayı yazma.
2. Teklif (offer) alanı kullanıcı tarafından verilmediyse hiçbir adayda indirim/kampanya/ücretsiz/bedava/fırsat/hediye vaadi, fiyat veya yüzde kullanma. ${OFFER_WORDS_TR_EN_NOTE}
3. Rakip pattern'leri İLHAM olarak kullan; rakip metni kopyalama, rakip adı geçirme.
4. Her aday için strateji, hook, hedef notu ve gerekçe (why) zorunlu. "why" araştırma/pattern/öğrenme referansı içermeli.
5. Meta pratikleri: primary_text için ilk 125 karakter kritik — hook metni primary_text'in BAŞINDA birebir yer almalı; headline kısa ve net (40 karakteri aşma); description opsiyonel ve kısa; CTA en fazla 4 kelime; primary_text 600 karakteri aşmasın.
6. Adaylar birbirinden GERÇEKTEN farklı olmalı: her aday farklı bir strateji ekseninde; birbirinin yeniden yazımı olan adaylar çeşitlilik cezası alır.
7. MARKA ÖĞRENMELERİ verilmişse dikkate al: bunlar geçmiş kampanya analizlerinden çıkan HİPOTEZLERDİR; verilen confidence ve örneklem notuyla tart, kesin gerçek sayma. Bir aday bir öğrenmeye dayanıyorsa "why" alanında ona referans ver.
8. Performans tahmini (CTR, CPC, ROAS, erişim, etkileşim sayısı) ÜRETME; bu sistem yalnız göreli sıralama yapar.
9. Çıktı dili: istenen copy dili. Çıktı SADECE geçerli JSON.`;

export type ArenaBrandInput = {
  brandName: string;
  description: string | null;
  website: string | null;
  targetMarket: string | null;
  copyLanguage: string | null;
  brandVoice: string | null;
  usp: string | null;
  products: unknown | null;
  researchResult: unknown | null;
  patternResult: unknown | null;
  learnings: Array<{ text: string; confidence: string; sampleNote: string }>;
  goal: string;
  offer: string | null;
  instruction: string | null;
};

function brandBlock(input: ArenaBrandInput): string {
  return `MARKA: ${input.brandName}
Web sitesi: ${input.website ?? "verilmedi"}
Kullanıcı açıklaması: ${input.description ?? "verilmedi"}
Marka sesi/tonu (kullanıcı girdisi): ${input.brandVoice ?? "verilmedi"}
Ayrıştırıcı değer önerisi (USP, kullanıcı girdisi): ${input.usp ?? "verilmedi"}
Ürünler (kullanıcı girdisi): ${input.products ? JSON.stringify(input.products) : "verilmedi"}
Hedef pazar: ${input.targetMarket ?? "verilmedi"}
Copy dili: ${input.copyLanguage ?? "tr"}
KAMPANYA HEDEFİ: ${GOAL_LABELS[input.goal] ?? input.goal}

MARKA ARAŞTIRMASI (kaynak takipli, yoksa null):
${input.researchResult ? JSON.stringify(input.researchResult) : "yok"}

PAZAR PATTERN ANALİZİ (rakip reklamlarından, yoksa null):
${input.patternResult ? JSON.stringify(input.patternResult) : "yok"}

MARKA ÖĞRENMELERİ (bu markanın geçmiş kampanya analizlerinden; hipotez muamelesi yap):
${input.learnings.length > 0 ? JSON.stringify(input.learnings) : "yok"}

KULLANICININ VERDİĞİ GERÇEK TEKLİF: ${input.offer ?? "YOK — hiçbir adayda teklif/indirim/fiyat/yüzde kullanma"}
KULLANICI YÖNLENDİRMESİ: ${input.instruction ?? "yok"}`;
}

const CANDIDATE_SCHEMA = `{
  "candidates": [
    {
      "axis": string,          // strateji ekseni anahtarı (verilen listeden)
      "strategy": string,      // bu adayın stratejisi, tek cümle
      "hook": string,          // açılış kancası — primary_text'in başında birebir geçmeli
      "primary_text": string,  // Meta primary text (≤ 600 karakter)
      "headline": string,      // ≤ 40 karakter
      "description": string | null,
      "cta": string,           // ≤ 4 kelime, ör. "Hemen Keşfet"
      "target_note": string,   // kime hitap ediyor
      "why": string            // neden bu yaklaşım (araştırma/pattern/öğrenme referansıyla)
    }
  ]
}`;

export function buildSeedPrompt(input: {
  brand: ArenaBrandInput;
  population: number;
  lintFeedback: string[];
}): string {
  const axes = STRATEGY_AXES.slice(0, input.population)
    .map((a) => `- ${a.key}: ${a.label} — ${a.note}`)
    .join("\n");
  return `${brandBlock(input.brand)}

STRATEJİ EKSENLERİ (her aday FARKLI bir eksende; sırayla kullan):
${axes}
${
  input.lintFeedback.length
    ? `
ÖNCEKİ DENEME KURAL İHLALLERİ — bunlardan KESİNLİKLE kaçın:
${input.lintFeedback.map((f) => `- ${f}`).join("\n")}
`
    : ""
}
TAM OLARAK ${input.population} aday üret. Şu JSON şemasına birebir uy:

${CANDIDATE_SCHEMA}`;
}

export type EliteForPrompt = {
  label: string; // "E1", "E2" ...
  strategy: string;
  hook: string;
  primaryText: string;
  headline: string;
  description: string | null;
  cta: string;
  targetNote: string | null;
  critiques: Array<{ judge: string; critique: string; suggestedMutation: string }>;
};

export function buildMutationPrompt(input: {
  brand: ArenaBrandInput;
  elites: EliteForPrompt[];
  childCount: number;
  includeCrossover: boolean;
  lintFeedback: string[];
}): string {
  const ops = MUTATION_OPERATORS.map((o) => `- ${o.key}: ${o.note}`).join("\n");
  const elites = input.elites
    .map(
      (e) => `[${e.label}]
strateji: ${e.strategy}
hook: ${e.hook}
primary_text: ${e.primaryText}
headline: ${e.headline}
description: ${e.description ?? "-"}
cta: ${e.cta}
hedef: ${e.targetNote ?? "-"}
JÜRİ ELEŞTİRİLERİ:
${e.critiques.map((c) => `  - ${c.judge}: ${c.critique} → önerilen mutasyon: ${c.suggestedMutation}`).join("\n")}`,
    )
    .join("\n\n");
  return `${brandBlock(input.brand)}

ÖNCEKİ TURUN ELİTLERİ (hayatta kalan adaylar; jüri eleştirileriyle):
${elites}

MUTASYON OPERATÖRLERİ:
${ops}
${input.includeCrossover ? `- ${CROSSOVER_OPERATOR}: iki elitin hook'u ve gövdesini birleştir (parent_id = hook'un geldiği elit, second_parent_id = gövdenin geldiği elit)` : ""}
${
  input.lintFeedback.length
    ? `
ÖNCEKİ DENEME KURAL İHLALLERİ — bunlardan KESİNLİKLE kaçın:
${input.lintFeedback.map((f) => `- ${f}`).join("\n")}
`
    : ""
}
Jüri eleştirilerine dayanarak elitlerden TAM OLARAK ${input.childCount} ÇOCUK aday üret${input.includeCrossover ? " (bunlardan tam 1 tanesi crossover)" : ""}. Her çocuk bir operatör uygular ve "why" alanında operatör adını ve hangi eleştiriye cevap verdiğini yazar. Çocuklar ebeveynin kopyası olmamalı; ebeveynin güçlü yanını koruyup eleştirilen yanını değiştirmeli. Elitleri TEKRAR ÜRETME (onlar otomatik taşınır).

Şu JSON şemasına birebir uy:

{
  "candidates": [
    {
      "parent_id": string,            // "E1" gibi elit etiketi
      "second_parent_id": string | null, // yalnız crossover için
      "operator": string,             // operatör anahtarı
      "strategy": string,
      "hook": string,
      "primary_text": string,
      "headline": string,
      "description": string | null,
      "cta": string,
      "target_note": string,
      "why": string
    }
  ]
}`;
}

export type GeneratedCandidate = {
  axis?: string;
  parent_id?: string;
  second_parent_id?: string | null;
  operator?: string;
  strategy?: string;
  hook?: string;
  primary_text?: string;
  headline?: string;
  description?: string | null;
  cta?: string;
  target_note?: string;
  why?: string;
};

// ---------------------------------------------------------------------------
// JÜRİ (JUDGE) — persona + "sayı tahmin etme, yalnız kıyasla"
// ---------------------------------------------------------------------------
const PERSONA_TEXT: Record<string, string> = {
  scroll_stopper:
    "Sen bir 'scroll-stopper' uzmanısın: akışta kaydırmayı ilk saniyede durduran kancaları değerlendirirsin. En çok 'attention' boyutuna önem verirsin.",
  brand_strategist:
    "Sen bir marka stratejistisin: copy'nin marka sesi, konumlanma ve araştırma bulgularıyla tutarlılığını değerlendirirsin. En çok 'brand_fit' boyutuna önem verirsin.",
  media_buyer:
    "Sen bir performans medya alıcısısın: copy'nin ne sunduğunu, kime ve neden şimdi olduğunu net söyleyip söylemediğini değerlendirirsin. En çok 'clarity' boyutuna önem verirsin.",
  audience_rep:
    "Sen hedef kitlenin temsilcisisin: aşağıdaki kitle hipotezindeki kişi olarak bu reklamı görsen ne hissederdin, bunu değerlendirirsin. En çok 'audience_fit' boyutuna önem verirsin.",
};

export function buildJudgeSystemPrompt(
  persona: JudgePersona,
  audienceHypotheses: string | null,
): string {
  const weights = JUDGE_DIMENSIONS.map((d) => `${d} ×${persona.weights[d]}`).join(", ");
  return `${PERSONA_TEXT[persona.key] ?? `Sen bir reklam jürisisin (${persona.label}).`}
${persona.key === "audience_rep" ? `KİTLE HİPOTEZİ (araştırmadan): ${audienceHypotheses ?? "verilmedi — genel hedef kitleyi varsay"}` : ""}

Görev: Verilen reklam copy adaylarını BİRBİRİNE GÖRE kıyasla. Her aday için 4 boyutu 1-10 arası puanla: attention (ilk saniye durdurucu mu), clarity (ne sunuyor, kime, neden şimdi), brand_fit (marka sesi/konumlanma/araştırma ile tutarlı mı), audience_fit (hedef nota ve kitleye uygun mu). Senin ağırlıkların: ${weights}.

Kesin kurallar:
1. SAYI TAHMİN ETME. CTR, CPC, ROAS, erişim, tıklama, dönüşüm gibi hiçbir performans tahmini yazma. Yalnızca adayları birbirine göre kıyasla.
2. Puanları ayrıştır: aynı puanı herkese verme; en iyi ve en zayıf aday arasında belirgin fark olsun.
3. Her aday için kısa, somut bir eleştiri (critique) ve tek bir önerilen mutasyon (suggested_mutation: hook_swap | shorten_to_125 | angle_shift | cta_change | social_context | proof_from_research | learning_informed — ve bir cümle açıklama) yaz.
4. Araştırmada olmayan bir iddia/sayı/indirim gördüysen critique'te belirt ve brand_fit'i düşür.
5. "ranking" alanı TÜM aday etiketlerini en iyiden en zayıfa, her birini tam bir kez içerir.
6. Çıktı SADECE geçerli JSON.`;
}

export type JudgeCandidateForPrompt = {
  label: string; // "A1".."An"
  strategy: string;
  hook: string;
  primaryText: string;
  headline: string;
  description: string | null;
  cta: string;
  targetNote: string | null;
};

export function buildJudgePrompt(input: {
  brandName: string;
  goal: string;
  offer: string | null;
  copyLanguage: string | null;
  brandContext: unknown; // araştırmadan kısa özet (positioning, tone, identity)
  candidates: JudgeCandidateForPrompt[];
}): string {
  const cands = input.candidates
    .map(
      (c) => `[${c.label}]
strateji: ${c.strategy}
hook: ${c.hook}
primary_text: ${c.primaryText}
headline: ${c.headline}
description: ${c.description ?? "-"}
cta: ${c.cta}
hedef notu: ${c.targetNote ?? "-"}`,
    )
    .join("\n\n");
  return `MARKA: ${input.brandName}
KAMPANYA HEDEFİ: ${GOAL_LABELS[input.goal] ?? input.goal}
Copy dili: ${input.copyLanguage ?? "tr"}
KULLANICININ GERÇEK TEKLİFİ: ${input.offer ?? "YOK — copy'de teklif/indirim OLMAMALI"}
MARKA BAĞLAMI (araştırmadan):
${JSON.stringify(input.brandContext)}

ADAYLAR (${input.candidates.length} adet):
${cands}

Şu JSON şemasına birebir uy:

{
  "scores": {
    "<aday etiketi>": {
      "attention": 1-10,
      "clarity": 1-10,
      "brand_fit": 1-10,
      "audience_fit": 1-10,
      "critique": string,
      "suggested_mutation": string
    }
  },
  "ranking": ["<en iyi etiket>", "...", "<en zayıf etiket>"]
}`;
}
