import "server-only";

// CLAUDE.md §25 — teşhis: gözlem + olası nedenler + kanıt + öneri + confidence.
// CLAUDE.md §27 — testte aynı anda TEK ana değişken.
// CLAUDE.md §30 — öneriler tavsiyedir; hiçbir şey otomatik uygulanmaz.
export const OPTIMIZATION_SYSTEM_PROMPT = `Sen kıdemli bir Meta Ads optimizasyon analistisin. Markanın ELLE girilmiş kampanya sonuçlarını, koddan hesaplanmış skorlarını ve gözlenen sinyallerini değerlendirip uygulanabilir öneriler üretiyorsun. Sistem Meta'ya bağlı DEĞİL; kullanıcı her değişikliği Ads Manager'da kendisi yapar.

Kesin kurallar:
1. YALNIZCA verilen sayıları, skorları ve sinyalleri kullan. Sektör benchmark'ı, performans tahmini veya uydurma sayı YAZMA.
2. AdScore markanın kendi geçmişine göre göreli skordur (50 = marka medyanı); onu mutlak kalite notu gibi yorumlama.
3. Her öneri için: gözlem + olası nedenler + kanıt (verilen sayıya/sinyale/skora referans) + somut aksiyon + confidence ("low"|"medium"|"high").
4. En fazla BİR öneri "test" türünde olsun: tek değişkenli bir sonraki deney (neyi, nasıl, hangi metrikle ölçüleceği aksiyonda yazsın).
5. Örneklem küçükse bunu ilgili her öneride açıkça belirt; güçlü sonuç çıkarma.
6. MARKA ÖĞRENMELERİ geçmiş analizlerden gelen HİPOTEZLERDİR; verilen confidence ve örneklem notuyla tart, kesin gerçek sayma.
7. Öneriler tavsiyedir; kullanıcı kabul/reddet eder ve kendisi uygular.
8. Çıktı dili Türkçe; çıktı SADECE geçerli JSON.`;

export function buildOptimizationPrompt(input: {
  brandName: string;
  description: string | null;
  targetMarket: string | null;
  snapshot: unknown;
  learnings: Array<{
    text: string;
    confidence: string;
    sampleNote: string;
  }>;
}): string {
  return `MARKA: ${input.brandName}
Açıklama: ${input.description ?? "verilmedi"}
Hedef pazar: ${input.targetMarket ?? "verilmedi"}

KOD HESABI SNAPSHOT (planlar, sonuçlar, koddan hesaplanan metrikler, AdScore'lar ve gözlenen sinyaller — bu sayıları aynen kullan, yeniden hesaplama):
${JSON.stringify(input.snapshot)}

MARKA ÖĞRENMELERİ (geçmiş analizlerden; hipotez muamelesi yap):
${input.learnings.length > 0 ? JSON.stringify(input.learnings) : "yok"}

Şu JSON şemasına birebir uy:

{
  "summary": string,
  "recommendations": [
    {
      "kind": "optimization" | "test",
      "observation": string,
      "possible_causes": [string],
      "evidence": string,
      "action": string,
      "confidence": "low" | "medium" | "high"
    }
  ],
  "data_gaps": [string]
}`;
}

export type OptimizationResult = {
  summary?: string;
  recommendations?: Array<{
    kind?: string;
    observation?: string;
    possible_causes?: string[];
    evidence?: string;
    action?: string;
    confidence?: string;
  }>;
  data_gaps?: string[];
};
