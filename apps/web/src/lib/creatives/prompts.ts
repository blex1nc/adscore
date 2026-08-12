import "server-only";

// CLAUDE.md §14/§15 — pattern'ler markaya uyarlanır; kopya üretilmez.
// CLAUDE.md §6/§31 — doğrulanmamış iddia, uydurma indirim/fiyat/istatistik yasak.
export const CREATIVE_SYSTEM_PROMPT = `Sen kıdemli bir performans reklam yazarısın. Görevin, verilen marka profili ve pazar pattern'lerinden yola çıkarak Meta reklamları için markaya özel copy varyantları üretmek.

Kesin kurallar:
1. YALNIZCA verilen marka/araştırma bilgilerini kullan. Doğrulanmamış iddia, uydurma indirim, fiyat, yüzde, istatistik, ödül veya müşteri sayısı YAZMA.
2. Teklif (offer) alanı kullanıcı tarafından verilmediyse hiçbir varyantta indirim/kampanya vaadi kullanma.
3. Rakip pattern'leri İLHAM olarak kullan; rakip metni kopyalama, rakip adı geçirme.
4. Her varyant için strateji, hook, hedef notu, gerekçe (why) ve confidence ("low"|"medium"|"high") zorunlu.
5. Meta pratikleri: primary_text için ilk 125 karakter kritik (öncesinde kancayı ver), headline kısa ve net (yaklaşık 40 karakteri aşma), description opsiyonel ve kısa.
6. Varyantlar birbirinden gerçekten farklı stratejiler denemeli (ör. problem hook / sosyal bağlam / ürün odaklı).
7. MARKA ÖĞRENMELERİ verilmişse dikkate al: bunlar geçmiş kampanya analizlerinden çıkan HİPOTEZLERDİR; verilen confidence ve örneklem notuyla tart, kesin gerçek sayma. Bir varyant bir öğrenmeye dayanıyorsa "why" alanında ona referans ver.
8. Çıktı dili: istenen copy dili. Çıktı SADECE geçerli JSON.`;

export function buildCreativePrompt(input: {
  brandName: string;
  description: string | null;
  targetMarket: string | null;
  copyLanguage: string | null;
  researchResult: unknown | null;
  patternResult: unknown | null;
  instruction: string | null;
  offer: string | null;
  learnings: Array<{ text: string; confidence: string; sampleNote: string }>;
  variantCount: number;
}): string {
  return `MARKA: ${input.brandName}
Kullanıcı açıklaması: ${input.description ?? "verilmedi"}
Hedef pazar: ${input.targetMarket ?? "verilmedi"}
Copy dili: ${input.copyLanguage ?? "tr"}

MARKA ARAŞTIRMASI (kaynak takipli, yoksa null):
${input.researchResult ? JSON.stringify(input.researchResult) : "yok"}

PAZAR PATTERN ANALİZİ (rakip reklamlarından, yoksa null):
${input.patternResult ? JSON.stringify(input.patternResult) : "yok"}

MARKA ÖĞRENMELERİ (bu markanın geçmiş kampanya analizlerinden; hipotez muamelesi yap):
${input.learnings.length > 0 ? JSON.stringify(input.learnings) : "yok"}

KULLANICININ VERDİĞİ GERÇEK TEKLİF: ${input.offer ?? "YOK — hiçbir varyantta teklif/indirim kullanma"}
KULLANICI YÖNLENDİRMESİ: ${input.instruction ?? "yok"}

${input.variantCount} farklı copy varyantı üret. Şu JSON şemasına birebir uy:

{
  "variants": [
    {
      "strategy": string,      // bu varyantın stratejisi, tek cümle
      "hook": string,          // açılış kancası
      "primary_text": string,  // Meta primary text
      "headline": string,
      "description": string | null,
      "cta": string,           // ör. "Hemen Keşfet"
      "target_note": string,   // kime hitap ediyor
      "why": string,           // neden bu yaklaşım (araştırma/pattern referansıyla)
      "confidence": "low" | "medium" | "high"
    }
  ]
}`;
}

export type CreativeVariant = {
  strategy?: string;
  hook?: string;
  primary_text?: string;
  headline?: string;
  description?: string | null;
  cta?: string;
  target_note?: string;
  why?: string;
  confidence?: string;
};
