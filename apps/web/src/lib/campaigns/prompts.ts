import "server-only";

// CLAUDE.md §18 — "best settings" mutlak gerçek değil: öneri + neden + confidence + alternatif.
// CLAUDE.md §6/§28 — performans tahmini (erişim, CTR, satış sayısı) ÜRETILMEZ.
export const CAMPAIGN_PLAN_SYSTEM_PROMPT = `Sen kıdemli bir Meta Ads medya planlayıcısısın. Görevin, markanın verilerinden ve kullanıcının bütçesinden yola çıkarak Ads Manager'da ELLE kurulacak eksiksiz bir kampanya planı hazırlamak. Sistem Meta'ya bağlı DEĞİL; kullanıcı reklamı kendisi açacak.

Kesin kurallar:
1. HİÇBİR performans tahmini verme: erişim, gösterim, tıklama, satış, CTR, CPA, ROAS sayısı YAZMA. Veri yok; tahmin uydurmak yasak.
2. Bütçeyi KULLANICI belirledi; senaryolar yalnızca bu bütçenin nasıl bölüştürüleceğini anlatır, harcama artışı ancak "öneri" olarak ve gerekçeyle sunulur.
3. Her ana öneri (objective, optimization event, yerleşim) için: öneri + neden + confidence ("low"|"medium"|"high") + varsa alternatif.
4. Kullanıcının Pixel/CAPI kurulumu OLMAYABİLİR; dönüşüm optimizasyonu önerirken bunu açıkça koşula bağla ve pixel yoksa güvenli alternatifi söyle.
5. Test yapısında aynı anda tek ana değişken test edilir.
6. Ads Manager adımlarını genel akış olarak yaz (menü adları değişebilir; "yaklaşık olarak" dili kullan).
7. MARKA ÖĞRENMELERİ verilmişse önerilerde dikkate al: bunlar geçmiş kampanya analizlerinden çıkan HİPOTEZLERDİR; verilen confidence ve örneklem notuyla tart, kesin gerçek sayma. Bir öneri bir öğrenmeye dayanıyorsa gerekçesinde ona referans ver.
8. Çıktı dili Türkçe; çıktı SADECE geçerli JSON.`;

export function buildCampaignPlanPrompt(input: {
  brandName: string;
  description: string | null;
  targetMarket: string | null;
  goal: string;
  budgetType: string;
  budgetAmount: string;
  currency: string;
  durationDays: number | null;
  notes: string | null;
  researchResult: unknown | null;
  patternResult: unknown | null;
  learnings: Array<{ text: string; confidence: string; sampleNote: string }>;
  creatives: Array<{
    headline: string;
    primaryText: string;
    cta: string;
    strategy: string;
  }>;
}): string {
  return `MARKA: ${input.brandName}
Açıklama: ${input.description ?? "verilmedi"}
Hedef pazar: ${input.targetMarket ?? "verilmedi"}

KULLANICI GİRDİLERİ:
- Kampanya hedefi: ${input.goal}
- Bütçe: ${input.budgetAmount} ${input.currency} (${input.budgetType === "DAILY" ? "günlük" : "toplam"})
- Süre: ${input.durationDays ? `${input.durationDays} gün` : "belirtilmedi"}
- Not: ${input.notes ?? "yok"}

ONAYLI CREATIVE'LER (${input.creatives.length} adet — kampanyada yalnızca bunlar kullanılacak):
${JSON.stringify(input.creatives)}

MARKA ARAŞTIRMASI: ${input.researchResult ? JSON.stringify(input.researchResult) : "yok"}
PAZAR PATTERN ANALİZİ: ${input.patternResult ? JSON.stringify(input.patternResult) : "yok"}
MARKA ÖĞRENMELERİ (geçmiş kampanya analizlerinden; hipotez muamelesi yap): ${input.learnings.length > 0 ? JSON.stringify(input.learnings) : "yok"}

Şu JSON şemasına birebir uy (Ads Manager alan adları/değerleri docs/META-ADS-MANAGER-FIELDS.md'den; "key"/enum alanları kurulum kitinin alanlara eşlemesi için zorunludur):

{
  "campaign_name": string,
  "objective": {
    "recommended": string,
    "key": "awareness"|"traffic"|"engagement"|"leads"|"app_promotion"|"sales",
    "reason": string, "confidence": "low"|"medium"|"high", "alternative": string | null
  },
  "special_ad_category": {
    "recommended": "NONE"|"EMPLOYMENT"|"HOUSING"|"CREDIT"|"ISSUES_ELECTIONS_POLITICS"|"ONLINE_GAMBLING_AND_GAMING"|"FINANCIAL_PRODUCTS_SERVICES",
    "reason": string
  },
  "optimization_event": {
    "recommended": string,
    "conversion_location": string,
    "performance_goal": string,
    "event_name": "PURCHASE"|"ADD_TO_CART"|"INITIATED_CHECKOUT"|"LEAD"|"COMPLETE_REGISTRATION"|"CONTENT_VIEW"|"CONTACT"|"SUBSCRIBE"|"START_TRIAL"|"SCHEDULE"|"SUBMIT_APPLICATION"|"OTHER"|null,
    "reason": string, "pixel_condition": string
  },
  "audience": {
    "suggestion": {
      "location": string, "locations": [ string ],
      "age": string, "age_min": number, "age_max": number,
      "gender": "all"|"men"|"women",
      "interests_behaviors": string, "detailed_targeting": [ string ],
      "advantage_plus_audience": boolean, "advantage_plus_note": string
    },
    "hypotheses": [ { "hypothesis": string, "confidence": "low"|"medium"|"high" } ]
  },
  "placements": { "recommended": string, "mode": "advantage_plus"|"manual", "list": [ string ], "reason": string, "confidence": "low"|"medium"|"high" },
  "structure": [
    { "adset_name": string, "purpose": string, "creative_headlines": [ string ], "test_variable": string | null }
  ],
  "budget_plan": {
    "level": "campaign"|"adset",
    "scenarios": [ { "name": "conservative"|"recommended"|"aggressive", "allocation": string, "note": string } ],
    "disclaimer": string
  },
  "manual_setup_steps": [ string ],
  "risks": [ string ],
  "data_gaps": [ string ]
}

Alan notları:
- "objective.key": Ads Manager'ın 6 hedefinden biri; "recommended" bunun açıklamalı hâli.
- "special_ad_category": işletme kredi/istihdam/konut/sosyal-politik/kumar/finansal ürün kapsamında değilse "NONE"; emin değilsen "NONE" de ve "reason"da kullanıcıya doğrulatmasını söyle.
- "conversion_location" ve "performance_goal": Ads Manager'ın Türkçe arayüzündeki adlarıyla. Satışlar amacında konumlar: "İnternet sitesi" | "Uygulama" | "İnternet sitesi ve uygulama" | "İnternet sitesi ve mağaza içi" | "İnternet sitesi ve aramalar" | "Messenger" | "WhatsApp". "İnternet sitesi" için performans hedefleri: "Dönüşüm sayısının en üst seviyeye çıkarılması" | "Dönüşümlerin değerinin en üst seviyeye çıkarılması" | "Yönlendirme sayfası görüntülemelerinin sayısının en üst seviyeye çıkarılması" | "Bağlantı tıklamalarının sayısının en üst seviyeye çıkarılması" | "Günlük tekil erişimin en üst seviyeye çıkarılması" | "Gösterim sayısını en üst seviyeye çıkarın". Trafik amacı, "İnternet sitesi" konumu: "Yönlendirme sayfası görüntülemelerinin sayısının en üst seviyeye çıkarılması" | "Bağlantı tıklamalarının sayısının en üst seviyeye çıkarılması" | "Günlük tekil erişimin en üst seviyeye çıkarılması" | "Gösterim sayısını en üst seviyeye çıkarın". "event_name": pixel standart event'i (API enum); pixel yoksa/bilinmiyorsa null ve "pixel_condition"da koşulu yaz.
- "placements.list": yalnız "mode" = "manual" ise doldur; aksi halde boş dizi.
- "budget_plan.level": bütçe kampanya düzeyinde mi (Advantage+ kampanya bütçesi) reklam seti düzeyinde mi.
- "creative_headlines": verilen onaylı creative'lerin başlıklarını BİREBİR kopyala (kit eşlemesi başlıkla yapılır).`;
}
