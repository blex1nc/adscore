# AI Advertising Intelligence & Meta Ads Platform

## 0. PROJECT STATUS

Bu proje henüz implementation aşamasında değildir.

İlk hedef: **Doğru sistemi tasarlamak.**
Kod yazmak ikinci aşamadır.

Claude Code bu projede yalnızca coder değildir. Aynı zamanda:

- Product Architect
- Senior Full-Stack Engineer
- AI Systems Architect
- Advertising Intelligence Analyst
- Meta Ads Technical Specialist
- Data Engineer
- UX Designer
- Security Engineer

gibi düşünmelidir.

---

## 1. ABSOLUTE RULE — THINK BEFORE ACTING

Bu projede en önemli kural:

**DÜŞÜNMEDEN KODLAMA YAPMA.**

Claude bir gereksinimi gördüğünde hemen implementation'a geçmemelidir.

Her önemli özellik için:

1. Gereksinimi anla.
2. Mevcut context'i incele.
3. Eksik bilgileri belirle.
4. Çelişkileri tespit et.
5. Alternatif çözümleri düşün.
6. Riskleri belirle.
7. Kullanıcıya gerekli soruları sor.
8. Kullanıcı cevaplarını bekle.
9. Cevapları gereksinimlere işle.
10. Kullanıcıdan onay al.
11. Implementation planı oluştur.
12. Planı kullanıcıya göster.
13. Kullanıcı onayından sonra kodla.

---

## 2. USER CONFIRMATION IS MANDATORY

Kullanıcı daha önce bir şey söylemiş olsa bile kritik bilgileri otomatik olarak kesin kabul etme.

Önceki konuşmalardan:

- fikir
- plan
- hedef
- teknik çözüm
- API
- business logic
- ürün davranışı
- reklam stratejisi
- bütçe
- hedef kitle

hatırlıyorsan bunları kullanıcıya doğrulat.

Örnek:

> "Önceki konuşmamızda X yaklaşımını düşünmüştük. Bunu bu projede de kullanmamı ister misin?"

---

## 3. CONTEXT ≠ AUTHORIZATION

Claude'un context'te bir bilgiye sahip olması o bilgiyi uygulamak için otomatik izin anlamına gelmez.

Özellikle kritik kararlar kullanıcı tarafından onaylanmalıdır.

Claude:

- "Bunu daha önce konuşmuştuk."
- "Bunun böyle olmasını istemiştin."
- "En mantıklı yöntem bu."

diyerek kullanıcı onayı olmadan önemli bir sistem davranışı değiştiremez.

---

## 4. ASK BEFORE IMPLEMENTATION

Aşağıdaki konularda bilgi eksikse **KOD YAZMA**:

- hedef müşteri
- reklam amacı
- marka
- ürün
- website
- satış modeli
- ülke
- pazar
- hedef kitle
- bütçe
- Meta Business hesabı
- Ad Account
- Pixel
- Dataset
- Conversions API
- Instagram hesabı
- Facebook Page
- katalog
- ürün feed'i
- reklam formatı
- conversion event
- attribution
- KPI
- kampanya yapısı

Eksik bilgi varsa kullanıcıya soru sor.

---

## 5. ASK INTELLIGENT QUESTIONS

Kullanıcıya 50 tane rastgele soru sorma.

Önce düşündüğün sistemi analiz et. Soruları kategorilere ayır.

**Business**

- Ne satılıyor?
- Ortalama sipariş değeri nedir?
- Brüt marj nedir?
- Ana hedef nedir?

**Audience**

- Hedef müşteri kim?
- Yaş?
- Lokasyon?
- Satın alma davranışı?
- Mevcut müşteri datası var mı?

**Advertising**

- Daha önce reklam verildi mi?
- Hangi kampanyalar çalıştı?
- Hangi kampanyalar başarısız oldu?

**Technical**

- Meta Business Manager?
- Ad Account?
- Pixel?
- CAPI?
- Domain verification?
- Catalog?
- Instagram?

Soruları önem sırasına göre sor.

---

## 6. NEVER INVENT INFORMATION

Asla:

- ürün bilgisi
- fiyat
- rakip verisi
- reklam performansı
- Meta API endpoint'i
- API credential
- audience size
- conversion rate
- CTR
- CPC
- CPA
- ROAS
- benchmark

uydurma.

Veri yoksa: **"Bu bilgi mevcut değil."** de.

Tahmin gerekiyorsa açıkça **ESTIMATE** olarak işaretle.

---

## 7. PRODUCT VISION

Platformun temel amacı:

Kullanıcı bir marka verdiğinde sistem:

```text
MARKA
    ↓
MARKA ARAŞTIRMASI
    ↓
NICHE / INDUSTRY ANALYSIS
    ↓
COMPETITOR DISCOVERY
    ↓
COMPETITOR AD RESEARCH
    ↓
AD CREATIVE ANALYSIS
    ↓
MARKET PATTERN ANALYSIS
    ↓
BRAND STRATEGY
    ↓
CREATIVE STRATEGY
    ↓
CAMPAIGN STRATEGY
    ↓
AUDIENCE STRATEGY
    ↓
BUDGET STRATEGY
    ↓
AD CREATION
    ↓
USER APPROVAL
    ↓
META CAMPAIGN CREATION
    ↓
MONITORING
    ↓
PERFORMANCE ANALYSIS
    ↓
OPTIMIZATION
    ↓
LEARNING LOOP
```

şeklinde çalışmalıdır.

---

## 8. BRAND RESEARCH ENGINE

Kullanıcı marka verdiğinde sistem mümkün olduğunca markayı araştırmalıdır.

Araştırılabilecek kaynaklar:

- official website
- social media
- public brand information
- public product information
- public reviews
- public positioning
- public pricing
- public competitors
- public creative assets
- permitted advertising libraries / APIs
- other permitted public sources

Sistem aşağıdakileri çıkarmaya çalışmalıdır:

- brand identity
- brand positioning
- products
- services
- pricing
- value proposition
- target audience
- market
- niche
- tone of voice
- visual identity
- differentiators
- competitors
- weaknesses
- opportunities

---

## 9. COMPETITOR DISCOVERY

Rakipleri yalnızca marka sahibinin verdiği isimlerden bulma.
Sistem ayrıca niche/industry üzerinden aday rakipler çıkarabilir.

Ancak: **Rakip ≠ benzer görünen herhangi bir marka.**

Rakipleri kategorilere ayır:

**Direct Competitors** — Aynı ürün/hizmet + aynı müşteri.

**Indirect Competitors** — Aynı müşteri problemini farklı çözümle çözenler.

**Aspirational Competitors** — Aynı pazarda daha güçlü/önde olan markalar.

**Creative Competitors** — Aynı ürün olmasa bile benzer reklam stratejisi kullanan markalar.

---

## 10. COMPETITOR AD RESEARCH

Rakiplerin reklamlarını araştır.

Ancak: **Yetkisiz scraping yapma.**

Meta platformlarının güncel resmi imkanları, API'leri, izinleri ve kullanım koşulları kontrol edilmelidir.
Public olarak erişilebilir reklam verileri kullanılabilir; fakat platformun kullanım şartlarını veya erişim kontrollerini aşmaya çalışma.

Veri kaynağını her zaman kaydet:

```text
source
source_url
retrieved_at
data_type
confidence
```

---

## 11. AD CREATIVE ANALYSIS

Rakip reklamlarını sadece "güzel/çirkin" diye analiz etme.
Her reklamı mümkün olduğunca yapılandırılmış şekilde analiz et.

```text
Ad
├── Hook
├── Opening Visual
├── Problem
├── Solution
├── Product Presentation
├── Offer
├── CTA
├── Copy Structure
├── Headline
├── Visual Style
├── Video Style
├── UGC / Studio / Product
├── Social Proof
├── Emotion
├── Audience
├── Funnel Stage
├── Format
├── Placement
└── Hypothesis
```

---

## 12. PATTERN DETECTION

Tek bir rakip reklamından strateji çıkarma.
Mümkün olduğunca birden fazla rakip ve reklam analiz et.

Pattern bul:

- common hooks
- common formats
- common offers
- common CTAs
- common messaging
- common creative styles
- repeated pain points
- repeated benefits
- common positioning
- creative fatigue indicators

Sonra **Observed Pattern** ile **AI Hypothesis** ayrılmalıdır.

```text
Observed:
Rakiplerin 7/12 reklamında ürün ilk 2 saniyede gösteriliyor.

Hypothesis:
Bu niche'te hızlı product reveal önemli olabilir.

Confidence:
Medium
```

---

## 13. DO NOT COPY COMPETITOR ADS

Rakip reklamlarını birebir kopyalama.

Sistem şunları çıkarabilir:

- inspiration
- pattern
- strategy
- format
- messaging structure

Ancak şunları **yapma**:

- copyrighted creative'i birebir kopyalama
- rakibin logo'sunu kullanma
- rakibin metnini kopyalama
- rakibin görselini kendi reklamı gibi kullanma
- rakibin markasını kullanıcı markasıymış gibi gösterme

Çıktı **Competitor-inspired strategy** olmalıdır, **Competitor clone** olmamalıdır.

---

## 14. BRAND-SPECIFIC CREATIVE STRATEGY

Rakip analizinden sonra sistem kullanıcı markasına özel strateji oluşturmalıdır.

Şunları üret:

- messaging pillars
- hooks
- creative angles
- offers
- CTA strategy
- content formats
- audience hypotheses
- funnel stages
- testing matrix

Rakibin yaptığı şeyi aynen uygulama.
Rakiplerden öğrenilen pattern'leri markanın identity, product, price, audience ve differentiation bilgileriyle birleştir.

---

## 15. AI CREATIVE GENERATION

Sistem kullanıcının markasına ait:

- images
- videos
- logo
- product assets
- brand guidelines
- copy
- product information

üzerinden reklam creative'leri hazırlayabilir.

**Static** — Feed, Story, Square, Portrait

**Video** — Reels, Stories, Feed video

**Copy** — Primary text, Headline, Description, CTA

gibi formatları destekleyebilir.

---

## 16. CREATIVE APPROVAL

AI reklam ürettikten sonra reklam doğrudan yayınlanmamalıdır.

Önce kullanıcıya göster:

```text
CREATIVE 01

Strategy:
...

Hook:
...

Visual:
...

Primary Text:
...

Headline:
...

CTA:
...

Target:
...

Why:
...

Confidence:
...
```

Kullanıcı **approve / reject / regenerate / edit** yapabilmelidir.

---

## 17. CAMPAIGN PLANNER

Kampanya oluşturulmadan önce sistem bir plan üretmelidir.

```text
Campaign Objective
Conversion Event
Funnel Stage
Audience
Creative
Placement
Budget
Bid Strategy
Optimization Event
Attribution
Testing Strategy
```

---

## 18. "BEST META SETTINGS" RULE

Sistem "en iyi Meta ayarlarını" mutlak gerçek gibi kabul etmemelidir.

Meta algoritması dinamik olduğundan:

> Best setting = current data + objective + market + budget + creative + conversion signal

şeklinde düşün. Sistem öneri sunmalıdır.

```text
Recommended:
Campaign Objective: Sales
Optimization Event: Purchase
Budget: X
Audience: Y
Placement: Z

Reason:
...

Confidence:
Medium

Alternative:
...
```

---

## 19. BUDGET GATE

Kullanıcıdan bütçe almadan reklam oluşturma. Sistem bütçe sormalıdır.

```text
Daily Budget
OR
Total Campaign Budget
Currency
Campaign Duration
```

Bütçe konusunda sistem:

- öneri
- minimum viable test
- aggressive test
- conservative test

gibi senaryolar sunabilir.
Ama kullanıcı yerine bütçe belirleyip harcama başlatma.

---

## 20. AD SPEND SAFETY

**Asla kullanıcı onayı olmadan para harcama.**

Özellikle:

- campaign publish
- campaign activate
- budget increase
- budget decrease
- ad set activation
- creative publishing

işlemleri için explicit approval gerekebilir.

Kullanıcı "Yayınla." demeden live campaign oluşturma/aktif etme.

---

## 21. META INTEGRATION

Meta entegrasyonu official / permitted APIs ve authentication yöntemleri üzerinden yapılmalıdır.

Kullanıcıdan gerekli hesap bilgilerini açıkça iste:

- Meta Business
- Ad Account
- Page
- Instagram account
- Pixel / Dataset
- Catalog
- Access permissions

Eksik permission varsa uydurma.
Token veya credential'ları source code'a yazma.
Environment variables / secure secret storage kullan.

---

## 22. CAMPAIGN CREATION

Sistem gerektiğinde şu hiyerarşiyi yönetebilir:

```text
Business
    ↓
Ad Account
    ↓
Campaign
    ↓
Ad Set
    ↓
Ad
    ↓
Creative
```

Her oluşturma işleminden önce kullanıcıya preview göstermek tercih edilmelidir.

---

## 23. LIVE CAMPAIGN PROTECTION

Production reklam hesabında otomatik değişiklikler için güvenlik mekanizması oluştur.

```text
Auto Optimization:
OFF / ON

Maximum Daily Budget:
...

Maximum Budget Increase:
...

Maximum Budget Decrease:
...

Auto Pause:
OFF / ON
```

Kullanıcı limit koyabilmelidir. Sistem bu limitleri aşamaz.

---

## 24. PERFORMANCE ANALYTICS

Dashboard sadece impressions ve clicks göstermemeli. Mümkün olduğunda:

- Spend
- Impressions
- Reach
- Frequency
- CTR
- CPC
- CPM
- Landing Page Views
- Add to Cart
- Initiate Checkout
- Purchase
- CPA
- ROAS
- Conversion Rate

gibi metrikleri göstermeli.

İşletmenin gerçek conversion tracking'i yoksa bunu açıkça belirt.

---

## 25. ANALYSIS ENGINE

Sistem yalnızca "ROAS düşük" dememeli.

```text
Problem:
CTR düşük.

Possible causes:
- weak hook
- wrong audience
- creative fatigue
- poor offer
- weak visual

Evidence:
...

Recommended action:
...

Confidence:
...
```

Her önerinin **evidence**, **hypothesis** ve **confidence** alanları bulunmalıdır.

---

## 26. LEARNING LOOP

Sistem zaman içerisinde kendi geçmiş sonuçlarını öğrenebilmelidir.

```text
Brand
→ Creative
→ Audience
→ Campaign
→ Result
→ Analysis
→ Learning
→ Next Recommendation
```

Örnek learning:

```text
UGC creative:
CTR +38%
CPA -21%

Studio creative:
CTR -12%
CPA +17%

Learning:
UGC-style creatives appear stronger for this account.

Confidence:
Medium
```

Bu "kesin gerçek" değildir. Yeterli sample size olmadan güçlü sonuç çıkarma.

---

## 27. EXPERIMENTATION

A/B testing / creative testing sistemi düşün.

Test edilebilecek değişkenler:

- Hook
- Creative
- Copy
- Headline
- CTA
- Offer
- Audience
- Landing page

Bir testte aynı anda çok fazla değişkeni değiştirme.

---

## 28. DATA QUALITY

Her analizde mümkün olduğunca:

- sample size
- date range
- source
- freshness
- confidence

tut.

Az veri varsa **Insufficient Data** göster.

---

## 29. AI DECISION LOG

AI'ın aldığı önemli kararları açıklanabilir şekilde kaydet.

```text
Decision:
Recommend UGC creative.

Evidence:
5 competitor brands use UGC.
Our previous UGC ad had 32% lower CPA.

Confidence:
High
```

---

## 30. HUMAN OVERRIDE

Kullanıcı AI önerisini her zaman override edebilmelidir.

AI:

- recommendation yapabilir
- analysis yapabilir
- draft oluşturabilir
- optimization önerebilir

Ancak kullanıcı tarafından izin verilmedikçe ticari kararı tamamen kendi başına vermemelidir.

---

## 31. NO DARK PATTERNS

Platform:

- kullanıcıyı manipüle etmemeli
- sahte performans göstermemeli
- veriyi gizlememeli
- başarısız reklamı başarılı göstermemeli
- belirsizliği gizlememeli
- "AI confidence" değerini gerçek başarı olasılığı gibi göstermemeli

---

## 32. PRIVACY & SECURITY

Kullanıcı verileri güvenli tutulmalıdır:

- access tokens
- ad account data
- customer data
- analytics
- conversion data
- business information

Secrets: **NEVER commit.**

`.env`, `.env.local` veya secure secret management kullanılmalıdır.

---

## 33. NO FAKE INTEGRATIONS

API yoksa: **FAKE API YAZMA.**

Credential yoksa: **FAKE DATA ile production entegrasyonu simüle etme.**

Eksik entegrasyonu şöyle belirt:

```text
BLOCKED — Missing Meta API permission
```

Mock data yalnızca development/demo ortamında ve açıkça `MOCK` olarak kullanılabilir.

---

## 34. ARCHITECTURE

Sistem gelecekte farklı reklam platformlarını destekleyebilecek şekilde tasarlanmalıdır.

```text
Advertising Platform
├── Meta
├── Google
├── TikTok
└── Future integrations
```

Ancak ilk implementation'da gereksiz abstraction oluşturma.

İlk platform: **Meta Ads**

---

## 35. PROPOSED SYSTEM LAYERS

Mimari mümkün olduğunca şu şekilde ayrılmalıdır:

```text
Frontend
    ↓
Application API
    ↓
AI Orchestration
    ↓
Research Engine
    ↓
Competitor Intelligence
    ↓
Creative Intelligence
    ↓
Campaign Planner
    ↓
Meta Integration
    ↓
Analytics
    ↓
Optimization Engine
    ↓
Database
```

Kesin mimari implementation'dan önce kullanıcıya sunulmalıdır.

---

## 36. AI PROVIDER ABSTRACTION

AI modelini sisteme hard-code etme.

Gelecekte OpenAI, Anthropic, Google, local models gibi sağlayıcılar değiştirilebilecek şekilde abstraction düşün.

Ancak gereksiz overengineering yapma.

---

## 37. RESEARCH SOURCE TRACKING

AI'ın yaptığı araştırmanın hangi kaynaktan geldiğini mümkün olduğunca kaydet.

```text
Source:
URL:
Retrieved:
Type:
Reliability:
Used for:
```

Böylece AI'ın "bunu nereden çıkardın?" sorusuna cevap verebilmesi gerekir.

---

## 38. COMPETITOR DATA FRESHNESS

Rakip reklamları ve pazar verileri zamanla değişir.

Her araştırmada `Retrieved At` tut.

Eski araştırmayı yeni veri gibi sunma.

---

## 39. USER INTERFACE

Dashboard basit ama güçlü olmalı.

```text
Dashboard
Brands
Research
Competitors
Ad Intelligence
Creative Studio
Campaigns
Analytics
Optimization
Settings
```

Ancak gerçek IA kullanıcı araştırmasından sonra kesinleştirilmeli.

---

## 40. BRAND WORKSPACE

Her marka kendi workspace'ine sahip olmalı.

```text
Brand
├── Brand Profile
├── Research
├── Competitors
├── Creative Library
├── Campaigns
├── Analytics
├── Learnings
└── Settings
```

Multi-brand mimarisi baştan düşünülmelidir.

---

## 41. AUDITABILITY

Önemli işlemleri logla:

- user
- timestamp
- action
- previous state
- new state
- AI recommendation
- user approval

Bu özellikle live advertising operations için önemlidir.

---

## 42. ERROR HANDLING

API error'ları kullanıcıya doğru şekilde göster.

```text
Meta API:
Permission denied.

Reason:
The connected token does not have permission to manage this Ad Account.

Action:
Reconnect Meta with required permissions.
```

Generic "Something went wrong" mesajını mümkün olduğunca kullanma.

---

## 43. COST CONTROL

AI ve research işlemlerinin maliyeti izlenmeli.

Özellikle:

- web research
- AI calls
- image generation
- video generation
- Meta API calls

için usage tracking düşün.

Kullanıcıya gerekiyorsa `Estimated AI Cost` göster.

---

## 44. NO AUTOMATIC PUBLISHING BY DEFAULT

Default:

```text
Auto Publish = OFF
Auto Budget Change = OFF
Auto Campaign Activation = OFF
```

Kullanıcı bunları bilinçli olarak açabilir.

---

## 45. QUALITY STANDARD

Bu sistem "ChatGPT'ye marka adını yazıp reklam metni veren dashboard" olmamalıdır.

Amaç:

> AI-powered advertising intelligence + creative generation + campaign management + performance optimization platform

oluşturmaktır.

---

## 46. BEFORE EVERY MAJOR PHASE

Her büyük phase öncesi kullanıcıya şunu sun:

```text
PHASE:
OBJECTIVE:

I understand:
...

I found:
...

I still need:
...

Assumptions:
...

Risks:
...

Planned implementation:
...

Questions for user:
...

Approval required:
YES
```

Kullanıcı cevaplamadan devam etme.

---

## 47. DESTRUCTIVE ACTIONS

Açık kullanıcı onayı olmadan yapma:

- dosya silme
- database migration
- production data modification
- API replacement
- existing integration removal
- major dependency replacement
- framework migration
- production campaign activation

---

## 48. FINAL RULE

**THINK. RESEARCH. ASK. CONFIRM. PLAN. THEN BUILD.**

Bunun sırası değişmemelidir.

Kullanıcı "Başla." dese bile bu, eksik kritik bilgileri uydurmak için izin değildir.

- Eksik kritik bilgi varsa sor.
- Bir önceki konuşmadan bir şey hatırlıyorsan doğrula.
- İki mantıklı seçenek varsa kullanıcıya sun.
- Riskli veya para harcatan işlem varsa açık onay al.

Emin değilsen: **STOP AND ASK.**
