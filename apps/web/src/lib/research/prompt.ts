import "server-only";
import type { SiteFetchResult } from "./fetch-site";

export const RESEARCH_SYSTEM_PROMPT = `Sen bir marka araştırma analistisin. Görevin, sağlanan website içeriğinden ve marka bilgilerinden YAPILANDIRILMIŞ bir marka profili çıkarmak.

Kesin kurallar:
1. YALNIZCA sağlanan içerikten çıkarım yap. Bilgi yoksa uydurma; ilgili alanı null bırak ve "data_gaps" listesine ekle.
2. Gözlem (içerikte açıkça yazan) ile hipotezi (senin çıkarımın) ayır. Hipotezler yalnızca "hypotheses" alanına girer ve her birine confidence ("low" | "medium" | "high") verilir.
3. Sayısal metrik (fiyat dışında), pazar payı, performans verisi UYDURMA.
4. Rakip adayları yalnızca içerikte geçen veya kategoriden güçlü şekilde çıkarsanabilen markalar olabilir; her birine neden ve tip ("direct" | "indirect" | "aspirational" | "creative") ekle. Emin değilsen listeye alma.
5. Çıktı dili: Türkçe.
6. Çıktı SADECE geçerli JSON olmalı; başka hiçbir metin ekleme.`;

export function buildResearchPrompt(input: {
  brandName: string;
  description: string | null;
  targetMarket: string | null;
  site: SiteFetchResult;
}): string {
  return `MARKA BİLGİLERİ (kullanıcı girdisi):
- İsim: ${input.brandName}
- Kullanıcı açıklaması: ${input.description ?? "verilmedi"}
- Hedef pazar: ${input.targetMarket ?? "verilmedi"}

WEBSITE İÇERİĞİ (${input.site.url}, HTTP ${input.site.httpStatus}):
- Sayfa başlığı: ${input.site.title ?? "yok"}
- Meta açıklama: ${input.site.description ?? "yok"}
- Sayfa metni:
"""
${input.site.text}
"""

Bu içerikten aşağıdaki JSON şemasına birebir uyan bir profil çıkar:

{
  "brand_identity": string | null,        // markanın ne olduğu, tek paragraf
  "positioning": string | null,           // pazardaki konumlanma
  "tone_of_voice": string | null,
  "products_services": [ { "name": string, "note": string | null } ],
  "value_propositions": [ string ],
  "market": {
    "niche": string | null,
    "category": string | null
  },
  "audience_hypotheses": [
    { "hypothesis": string, "confidence": "low" | "medium" | "high" }
  ],
  "competitor_candidates": [
    { "name": string, "reason": string, "type": "direct" | "indirect" | "aspirational" | "creative" }
  ],
  "hypotheses": [
    { "hypothesis": string, "confidence": "low" | "medium" | "high" }
  ],
  "data_gaps": [ string ]                 // içerikten çıkarılamayan önemli bilgiler
}`;
}

// Result JSON'unun beklenen üst yapısı (görüntüleme için gevşek tip)
export type ResearchResult = {
  brand_identity?: string | null;
  positioning?: string | null;
  tone_of_voice?: string | null;
  products_services?: Array<{ name?: string; note?: string | null }>;
  value_propositions?: string[];
  market?: { niche?: string | null; category?: string | null };
  audience_hypotheses?: Array<{ hypothesis?: string; confidence?: string }>;
  competitor_candidates?: Array<{
    name?: string;
    reason?: string;
    type?: string;
  }>;
  hypotheses?: Array<{ hypothesis?: string; confidence?: string }>;
  data_gaps?: string[];
};
