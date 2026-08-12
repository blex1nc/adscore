import "server-only";

// CLAUDE.md §11 — reklam "güzel/çirkin" diye değil, yapılandırılmış analiz edilir.
// v1 girdisi metin olduğundan görsel alanlar ancak metinde tarif edildiyse doldurulur.
export const AD_ANALYSIS_SYSTEM_PROMPT = `Sen bir reklam analistisin. Sana bir rakip reklamının metni/tarifi verilecek. Görevin bunu yapılandırılmış olarak analiz etmek.

Kesin kurallar:
1. YALNIZCA verilen metinden çıkarım yap. Metinde olmayan görsel/video özelliklerini uydurma; ilgili alanı null bırak ve "data_gaps" listesine ekle.
2. Çıkarım olan her alan hipotezdir; "audience_hypothesis" ve "hypotheses" alanlarında confidence ("low" | "medium" | "high") zorunludur.
3. Performans verisi (CTR, satış, izlenme) UYDURMA.
4. Amaç kopyalamak değil öğrenmektir; analiz yapıyı çıkarır, metni yeniden üretmez.
5. Çıktı dili Türkçe; çıktı SADECE geçerli JSON.`;

export function buildAdAnalysisPrompt(input: {
  competitorName: string;
  competitorType: string;
  adText: string;
  adUrl: string | null;
}): string {
  return `RAKİP: ${input.competitorName} (tip: ${input.competitorType})
REKLAM KAYNAĞI: ${input.adUrl ?? "verilmedi"}

REKLAM METNİ / TARİFİ:
"""
${input.adText}
"""

Şu JSON şemasına birebir uy:

{
  "hook": string | null,
  "problem": string | null,
  "solution": string | null,
  "product_presentation": string | null,
  "offer": string | null,
  "cta": string | null,
  "headline": string | null,
  "copy_structure": string | null,
  "visual_style": string | null,
  "format": "UGC" | "STUDIO" | "PRODUCT" | "TEXT" | "UNKNOWN",
  "social_proof": string | null,
  "emotion": string | null,
  "funnel_stage": "TOF" | "MOF" | "BOF" | "UNKNOWN",
  "audience_hypothesis": { "hypothesis": string, "confidence": "low" | "medium" | "high" } | null,
  "hypotheses": [ { "hypothesis": string, "confidence": "low" | "medium" | "high" } ],
  "data_gaps": [ string ]
}`;
}

// CLAUDE.md §12 — Observed Pattern ile AI Hypothesis ayrılır; tek reklamdan strateji çıkmaz.
export const PATTERN_SYSTEM_PROMPT = `Sen bir pazar analisti olarak birden fazla rakip reklam analizinden pattern çıkarıyorsun.

Kesin kurallar:
1. "observed_patterns" yalnızca EN AZ 2 reklamda görülen tekrarları içerir; her birine kanıt sayısı yaz (örn. "5/8 reklamda problem hook'u var").
2. Tek reklamda görüneni pattern sayma; gerekiyorsa "hypotheses" altına confidence ile yaz.
3. Sayı uydurma; kanıt sayıları verilen analizlerden birebir sayılmalı.
4. Bu analiz kopyalama için değil, öğrenme içindir (kullanıcının markasına uyarlanacak).
5. Çıktı dili Türkçe; çıktı SADECE geçerli JSON.`;

export function buildPatternPrompt(input: {
  brandName: string;
  targetMarket: string | null;
  analyses: Array<{ competitor: string; type: string; analysis: unknown }>;
}): string {
  return `KULLANICI MARKASI: ${input.brandName} (hedef pazar: ${input.targetMarket ?? "belirtilmedi"})

ANALİZ EDİLMİŞ ${input.analyses.length} RAKİP REKLAMI:
${JSON.stringify(input.analyses, null, 2)}

Şu JSON şemasına birebir uy:

{
  "observed_patterns": [
    { "pattern": string, "evidence": string }   // evidence: "X/Y reklamda ..." formatında
  ],
  "hypotheses": [
    { "hypothesis": string, "confidence": "low" | "medium" | "high" }
  ],
  "adaptation_notes": [ string ],   // bu pattern'lerin kullanıcı markasına NASIL uyarlanabileceği (kopya değil)
  "data_gaps": [ string ]
}`;
}
