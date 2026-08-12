# AI Advertising Intelligence Platform — HANDOFF

## 1. PRODUCT

Bu proje, markaların Meta reklamlarını araştırma, planlama, üretme, yayınlama, analiz etme ve optimize etme süreçlerini tek bir AI destekli platform altında birleştiren bir reklam yönetim sistemidir.

Sistem sadece reklam oluşturmayacak.

- Bir markayı anlayacak.
- Markanın bulunduğu niche'i araştıracak.
- Aynı niche'teki işletmeleri ve onların reklam stratejilerini inceleyecek.
- Bu araştırmadan pattern'ler çıkaracak.
- Ardından bu pattern'leri kullanıcının kendi markasına uyarlayacak.
- AI tarafından creative'ler hazırlanacak.
- Kullanıcı creative'leri inceleyecek.
- Kampanya planı hazırlanacak.
- Bütçe kullanıcıdan alınacak.
- Kullanıcı onayından sonra Meta üzerinde kampanya oluşturulacak.
- Sonrasında performans izlenecek ve sistem yeni veriler üzerinden optimizasyon önerileri oluşturacak.

---

## 2. CORE FLOW

Temel sistem:

```text
USER
 ↓
CREATE BRAND
 ↓
BRAND RESEARCH
 ↓
NICHE IDENTIFICATION
 ↓
MARKET RESEARCH
 ↓
COMPETITOR DISCOVERY
 ↓
COMPETITOR AD RESEARCH
 ↓
AD CREATIVE ANALYSIS
 ↓
PATTERN DETECTION
 ↓
BRAND-SPECIFIC STRATEGY
 ↓
CREATIVE STRATEGY
 ↓
AI CREATIVE GENERATION
 ↓
USER APPROVAL
 ↓
CAMPAIGN STRATEGY
 ↓
BUDGET INPUT
 ↓
META CAMPAIGN PREVIEW
 ↓
USER APPROVAL
 ↓
META CAMPAIGN CREATION
 ↓
PERFORMANCE DATA
 ↓
ANALYSIS
 ↓
OPTIMIZATION
 ↓
LEARNING LOOP
```

---

## 3. CORE PRODUCT MODULES

İlk aşamada aşağıdaki modüller düşünülmeli:

### Brand Management

- Brand creation
- Brand profile
- Website
- Social accounts
- Products
- Services
- Target market
- Brand voice
- Brand assets
- Brand guidelines

### Research

- Brand research
- Market research
- Niche analysis
- Competitor discovery
- Competitor analysis

### Ad Intelligence

- Competitor advertisements
- Creative analysis
- Hooks
- Copy
- Offers
- CTA
- Format
- Creative patterns
- Market trends

### Creative Studio

- AI copy
- Image creative
- Video creative
- Ad variants
- Creative library
- Regeneration
- Editing
- Approval

### Campaign Builder

- Objective
- Conversion event
- Audience
- Placements
- Budget
- Bidding
- Optimization
- Attribution
- Creative selection

### Meta Integration

- Business
- Ad Account
- Page
- Instagram
- Pixel / Dataset
- Catalog
- Campaign
- Ad Set
- Ad
- Creative

### Analytics

- Spend
- Reach
- Impressions
- Frequency
- CTR
- CPC
- CPM
- Conversion rate
- CPA
- ROAS
- Purchases
- Revenue

### Optimization

- Performance analysis
- Creative fatigue
- Audience analysis
- Budget recommendations
- Creative recommendations
- Testing recommendations
- Learning system

---

## 4. MOST IMPORTANT PRODUCT PRINCIPLE

Platform: **DO NOT blindly copy competitors.**

Platform: **LEARN FROM COMPETITORS.**

Örneğin — Competitor: `"UGC video + problem hook + discount"`

Sistem bunu:

```text
Format = UGC
Hook = Problem
Offer = Discount
```

şeklinde anlayabilir.

Sonra kullanıcının markası için:

```text
Brand-specific UGC
Brand-specific problem
Brand-specific offer
```

oluşturmalıdır.

---

## 5. RESEARCH ENGINE

Research engine yalnızca search result toplamakla kalmamalıdır.
**Information extraction + reasoning** yapmalıdır.

```text
Source
↓
Facts
↓
Entities
↓
Market
↓
Competitors
↓
Patterns
↓
Hypotheses
```

Her hypothesis için confidence score düşün.

---

## 6. AD INTELLIGENCE ENGINE

Her reklam mümkün olduğunca structured data haline getirilmelidir.

```json
{
  "hook": "...",
  "format": "UGC_VIDEO",
  "offer": "...",
  "cta": "...",
  "audience_hypothesis": "...",
  "funnel_stage": "...",
  "visual_style": "...",
  "copy_style": "...",
  "source": "...",
  "retrieved_at": "...",
  "confidence": "medium"
}
```

Ancak gerçek schema implementation'dan önce kullanıcıyla birlikte belirlenmelidir.

---

## 7. CREATIVE ENGINE

**Input:**

```text
Brand
Product
Audience
Market
Competitor Patterns
Creative Strategy
Offer
Campaign Objective
```

**Output:**

```text
Creative Concepts
Copy
Visual Directions
Image Prompts
Video Prompts
CTA
Headline
```

Creative'ler kullanıcıya gösterilmeden yayınlanmamalıdır.

---

## 8. CAMPAIGN ENGINE

Campaign Engine:

```text
Brand
+
Objective
+
Budget
+
Audience
+
Creative
+
Conversion Data
```

üzerinden campaign proposal oluşturmalıdır.

Proposal şunları içermelidir:

```text
Campaign Objective
Campaign Structure
Audience
Placements
Optimization Event
Budget
Creative
Testing Plan
Expected Risks
```

---

## 9. META PUBLISHING

Meta yayınlama iki aşamalı olmalıdır.

### Stage 1 — Preview

Sistem kullanıcıya gösterir:

```text
Campaign
Ad Sets
Ads
Creative
Audience
Budget
Optimization
```

### Stage 2 — Approval

Kullanıcı **"Approve & Publish"** der.

Ancak ondan sonra live action gerçekleştirilir.

---

## 10. BUDGET

Kullanıcı belirleyebilir:

- daily budget
- lifetime budget
- currency
- duration

AI şu senaryoları önerebilir:

- conservative
- recommended
- aggressive

Ancak **AI kullanıcı adına para harcamaz.**

---

## 11. OPTIMIZATION

Sistem canlı kampanyadan veri aldıktan sonra:

```text
Performance
↓
Diagnosis
↓
Hypothesis
↓
Recommendation
↓
User Approval
↓
Change
↓
Result
↓
Learning
```

döngüsünü kullanmalıdır.

İlk sürümde otomatik optimizasyon yerine **AI recommendation + human approval** daha güvenli bir başlangıçtır.

---

## 12. LEARNING

Sistem marka bazında geçmiş sonuçları saklamalıdır.

```text
Brand X

Creative:
UGC

Result:
CPA -22%

Audience:
18-34

Result:
Strong

Learning:
UGC creatives may perform better for this audience.
```

Bu learning future recommendations'ta kullanılabilir.

---

## 13. MULTI-BRAND

Platform uzun vadede birden fazla marka desteklemelidir.

```text
Workspace
 ├── Brand A
 │    ├── Research
 │    ├── Ads
 │    ├── Campaigns
 │    └── Analytics
 │
 └── Brand B
      ├── Research
      ├── Ads
      ├── Campaigns
      └── Analytics
```

---

## 14. CURRENT DEVELOPMENT STATUS

**PHASE 4 (Creative Studio v1) TAMAM VE CANLI TEST EDİLDİ (2026-08-12).**

- Şema: `CreativeGeneration` (instruction + kullanıcının GERÇEK teklifi) + `Creative` (strategy/hook/primaryText/headline/description/cta/targetNote/why/confidence, approval: PENDING/APPROVED/REJECTED).
- Üretim: tek çağrıda 3 farklı stratejili varyant; girdiler = marka profili + son COMPLETED research + son COMPLETED pattern. **Araştırma yoksa üretim reddedilir** (veri temelsiz copy yok). Teklif kullanıcı girmediyse copy'de hiçbir indirim/vaat kullanılmaz — canlı testte doğrulandı: yalnız verilen teklif kullanıldı, uydurma iddia yok, "why" alanları araştırma/pattern bulgularına referans verdi.
- Onay akışı (CLAUDE.md §16): approve / reject / geri al / düzenle — düzenlenen creative otomatik yeniden onaya düşer (`editedAt` işlenir). Hepsi audit log'lu ve canlı test edildi.
- UI: `/app/brands/[id]/creatives`; marka sayfasından link. Onaysız creative'in kampanyada kullanılamayacağı kuralı Phase 6'da campaign builder'a bağlanacak.

**PHASE 2 + 3 GERÇEK AI ÇAĞRILARIYLA DOĞRULANDI (2026-08-12).** Kullanıcı Gemini key'ini `.env.local`e ekledi; tüm zincir canlı test edildi:

- **Marka araştırması:** kronotrop.com.tr (gerçek site) → kaynak kaydı + yapılandırılmış profil (gerçek site verileri: kargo eşiği, ürün serileri; confidence'lı hipotezler; dürüst data_gaps). Model: gemini-flash-latest, ~1.6K+1.2K token.
- **Reklam analizi:** 3 reklam analiz edildi (format/funnel/hook doğru çıkarıldı; UGC tarifi UGC olarak etiketlendi).
- **Pattern analizi:** 3 reklamdan kanıt sayılı observed pattern'ler ("3/3 reklamda ilk alıma özel teklif"), confidence'lı hipotezler, markaya özel uyarlama notları.
- **Adapter dayanıklılığı kanıtlandı:** `gemini-2.5-flash` yeni kullanıcılara kapanmış (404) → varsayılan `gemini-flash-latest` alias'ına çevrildi; 503 yoğunlukta retry/backoff + model fallback eklendi ve canlıda çalıştı (bir analiz fallback ile `gemini-3.6-flash`te tamamlandı). Sabitlemek için `GEMINI_MODEL` env override mevcut.

**PHASE 3 (Competitor Intelligence v1) İSKELETİ TAMAM (2026-08-12).**

**Phase 3'te kurulanlar:**

- Şema: `Competitor` (tip: direct/indirect/aspirational/creative; addedFrom: user/research), `CompetitorAd` (inputText + opsiyonel kaynak URL — içerik kopyalanmaz, referans+analiz saklanır), `PatternAnalysis`.
- v1 yolu (pazar-bazlı hibrit kararının manuel tarafı): kullanıcı reklam metnini/tarifini yapıştırır → AI yapılandırılmış analiz (CLAUDE.md §11 şeması: hook/offer/cta/format/funnel + confidence'lı hipotezler + data_gaps). Ad Library API yolu Meta bağlantısıyla (Phase 5+) eklenecek.
- Pattern analizi (CLAUDE.md §12): **en az 3 analiz edilmiş reklam** şartı hem action'da hem executor'da; observed (kanıt sayılı, "X/Y reklamda") ile hypothesis (confidence'lı) ayrık; çıktıda markaya uyarlama notları (kopya değil).
- UI: `/app/brands/[id]/competitors` — rakip ekleme (elle veya araştırma adayından tek tık), reklam ekleme + analiz görünümü, pattern bölümü; marka sayfasından "Rakipler →" linki.
- Doğrulanan: rakip ekleme, reklam ekleme, keysiz koşuda dürüst BLOCKED, pattern kapısı (0/3 gösterimi). Gerçek AI çağrıları hâlâ kullanıcı key'ini bekliyor.
- Yakalanan operasyonel not: migration sonrası çalışan dev server'da Prisma client bellekte eski kalıyor — **her migration'dan sonra dev server yeniden başlatılmalı.**

**PHASE 2 (Research Engine v1) İSKELETİ TAMAM (2026-08-12).**

**Phase 2'de kurulanlar:**

- Şema: `ResearchRun` (status/result/model/token sayıları) + `ResearchSource` (url, reliability, retrieved_at — CLAUDE.md §37). Marka silinince cascade.
- `packages/ai`: provider abstraction (CLAUDE.md §36) + Gemini adapter (key header'da taşınır, URL'de değil; `GEMINI_MODEL` env ile model override). Key yoksa `AiBlockedError` → UI'da dürüst `BLOCKED` (CLAUDE.md §33, fake fallback yok — doğrulandı).
- Pipeline: website fetch (SSRF korumalı: private IP/localhost/port engelleri; 15s timeout; 1.5MB sınır; HTML→metin), yapılandırılmış TR prompt (yalnız verilen içerikten çıkarım, observed/hypothesis ayrımı, confidence, data_gaps), `after()` ile arka plan koşusu, audit log.
- UI: marka sayfasında araştırma bölümü — başlat/yeniden araştır, durum çipi + 3sn poller, sonuç görünümü (kimlik/konumlanma/ürünler/kitle hipotezleri + confidence rozetleri/rakip adayları/eksik veri), kaynak listesi, önceki koşular.
- **Henüz test edilmedi:** gerçek Gemini çağrısı (kullanıcı key'i bekleniyor — sohbete yapıştırılan key ifşa sayıldı, yenilenmesi istendi). BLOCKED/FAILED yolları test edildi.
- **Sınır:** JS-render edilen siteler okunamıyor (dürüst hata mesajı var); headless fetch Phase 2 devamında değerlendirilecek. Gerçek queue/worker hâlâ yok (`after()` geçici çözüm).
- Ürün adı kesinleşti: **AdScore**. Repo git'e alındı (ilk commit: Phase 1).

**PHASE 1 TAMAMLANDI (2026-08-12).** Detay:

Dokümanlar: `CLAUDE.md`, `HANDOFF.md`, `DESIGN-REFERENCES.md`, `ARCHITECTURE-REPORT.md`, `PHASE0-META-VERIFICATION.md`.

**Phase 1'de kurulanlar (doğrulanmış, çalışıyor):**

- pnpm monorepo: `apps/web` (Next.js 16.3 + React 19 + Tailwind v4 + TS), `packages/db` (Prisma 6 + lokal Postgres 17, db: `adscore_dev`).
- Semantic token sistemi (`globals.css`): panel dark+light (`data-theme`), landing `.skin-landing` ile dark kilitli; component'lerde ham renk yok. Inter + Instrument Serif.
- Auth: davetli kayıt + login/logout + şifre değiştirme. Lean custom session (jose JWT httpOnly cookie + bcryptjs). NOT: managed auth yerine bilinçli tercih; **production öncesi güvenlik incelemesi zorunlu.** Self-serve signup yok.
- Guard: `src/proxy.ts` (Next 16'da middleware'in yeni adı) — `/app`, `/admin` korumalı; admin rol kontrolü.
- Panel: sidebar (gelecek modüller "yakında" etiketiyle pasif) + topbar + tema toggle; dashboard sahte metriksiz boş durumlar; Brand CRUD (create/update/delete + audit log + tenant izolasyonu workspace scoping ile).
- Internal admin panel: `/admin` — davet oluşturma (kopyalanabilir link, 7 gün geçerli, opsiyonel e-posta kilidi), davet iptali, kullanıcı listesi.
- Landing: Referans A uyarlaması, TR copy; scroll-scrubbed video (frame cache + canvas + seek fallback, CORS temiz), reveal animasyonları (prefers-reduced-motion destekli). Video hâlâ üçüncü taraf yer tutucu (TODO işaretli, §22.2).
- Seed: `pnpm db:seed` → admin `418off@gmail.com` (dev şifresi terminalde yazdı; panelden değiştirilebilir).
- Dev DB'de test verisi: `test@ornek.dev` kullanıcısı + "Örnek Kahve" markası (e2e doğrulamadan kaldı; silinebilir).

**Bilinçli sapmalar / notlar:**

- `apps/api` ve `apps/worker` henüz açılmadı: Phase 1'in ihtiyacı yoktu; Next.js server actions yeterli. Worker, Phase 2 (research job'ları) ile geliyor — o noktada Vercel dışı küçük bir host veya serverless-uyumlu queue kararı verilecek.
- Repo henüz git değil; kullanıcı onayı bekleniyor (`git init` + ilk commit).

Alınmış kararlar için bkz. **Bölüm 21 — CONFIRMED PRODUCT DECISIONS**.

---

## 15. FIRST TASK

Claude Code'un ilk görevi kod yazmak değildir.

### A. Product Discovery

Bu ürünün eksik parçalarını çıkar.

### B. Requirements Discovery

Gereken tüm özellikleri listele.

### C. Risk Analysis

Özellikle şu konuları incele:

- Meta API
- permissions
- privacy
- competitor research
- scraping
- AI-generated creative
- automated ad spend
- account security

### D. Architecture Proposal

Önerilen mimariyi çıkar:

- frontend
- backend
- database
- AI layer
- research layer
- Meta integration
- storage
- queue
- analytics

### E. Missing Requirements

Kullanıcıya sorulması gereken her şeyi çıkar.

---

## 16. DO NOT BUILD YET

Şu aşamada yapılmayacaklar:

- database schema finalize etme
- Meta integration yazma
- campaign publisher yazma
- AI workflow finalize etme
- scraping sistemi yazma
- creative generator finalize etme
- production deployment yapma

Bunlar kullanıcı gereksinimleri netleştikten sonra yapılacaktır.

---

## 17. QUESTIONS MUST BE SMART

Kullanıcıya sorularını kategorize ederek sor.

Öncelik:

1. Business model
2. User type
3. Brand workflow
4. Research
5. Competitor intelligence
6. Creative generation
7. Meta integration
8. Analytics
9. Automation
10. Security
11. Billing
12. Infrastructure

Her kategoride yalnızca gerçekten gerekli soruları sor.

---

## 18. IMPORTANT — THINK OF MISSING FEATURES

Kullanıcının söylemediği ancak bu platform için önemli olabilecek şeyleri kendin tespit et.

Örneğin düşün:

- authentication
- multi-user teams
- roles
- permissions
- workspace
- brand assets
- creative approval
- campaign approval
- audit logs
- Meta OAuth
- token security
- billing
- AI usage limits
- research history
- competitor tracking
- creative library
- campaign templates
- notifications
- scheduled research
- scheduled reports
- performance alerts
- budget safeguards
- account-level spending limits
- experiment management
- attribution
- data retention
- privacy
- GDPR / KVKK considerations
- API rate limits
- job queues
- retries
- observability
- backups

Bunları doğrudan implement etme.

Önce kullanıcıya sor:

```text
I think this feature may be important because...
Do you want this?
```

---

## 19. NEVER ASSUME

Özellikle şu konularda varsayım yapma:

- Meta account structure
- business structure
- billing model
- user permissions
- budget authority
- campaign automation
- competitor data sources
- AI providers
- creative generation providers

---

## 20. DECISION GATE

Her önemli karar şu şekilde ilerlemelidir:

```text
DISCOVER
 ↓
ASK
 ↓
USER ANSWER
 ↓
PROPOSE
 ↓
USER CONFIRM
 ↓
IMPLEMENT
```

---

## 21. CONFIRMED PRODUCT DECISIONS

Kullanıcı tarafından **2026-08-12 tarihinde onaylanmış** kararlar.
Bunlar artık açık soru değildir. Ancak implementation detayları hâlâ onaya tabidir.

### 21.1 Delivery Model — SaaS / B2B

Platform kendi markası için iç araç değil, **B2B SaaS** olarak geliştirilecektir.

Bunun doğrudan sonuçları:

- Multi-tenant mimari gereklidir.
- Her müşteri kendi workspace'ine sahip olur.
- Bir workspace birden fazla marka barındırabilir (bkz. Bölüm 13).
- Authentication zorunludur.
- Tenant izolasyonu zorunludur — bir müşterinin verisi başka müşteriye sızmamalıdır.

**Henüz kararlaştırılmamış (kullanıcıya sorulacak):**

- Pricing modeli (seat / workspace / ad spend yüzdesi / AI usage)
- Team & roles (tek kullanıcı mı, ekip + rol yönetimi mi)
- Self-serve signup mı, davetli onboarding mi
- Billing sağlayıcısı
- Ajans kullanım senaryosu (bir müşteri, birden fazla client markası yönetecek mi)

### 21.2 Design Direction — REFERANSLAR ALINDI

Tasarım referansları 2026-08-12 tarihinde kullanıcı tarafından gönderildi.

**Tam spec metinleri: `DESIGN-REFERENCES.md`**

| # | Referans | Kullanım yeri |
|---|----------|---------------|
| **A** | NovaAI — dark cinematic, scroll-scrubbed video | Sitenin **ana giriş ekranı** (public landing) |
| **B** | Nexora — light SaaS, Instrument Serif + Inter, kod ile yazılmış dashboard | **Uygulama arayüzü** (panel) |
| **C** | Webfluin — dark estimation calculator | **Analiz sonrası bütçe → tahmini etkileşim** ekranı |

Referanslar **görsel yön** olarak onaylanmıştır. Birebir kopyalanacakları anlamına gelmez:
marka, copy, asset ve içerik bu projeye uyarlanacaktır.

### 21.3 Theme — Dark + Light

Site **hem karanlık hem aydınlık** tema destekleyecektir.

- Tek bir semantic token katmanı kurulacak, iki tema bu katmanı override edecek.
- Component'lerde ham renk değeri (hex/rgba) kullanılmayacak.
- Referansların ham renkleri (`#0D0D0D`, `#FF5656`, `bg-white/15` vb.) token'a çevrilecek.

Bu karar referansların kendi spec'leriyle çelişmektedir — bkz. Bölüm 22.1.

### 21.4 Meta Connection — Panel Üzerinden

Meta Business hesabı **panel üzerinden bağlanacak ve panel üzerinden ayarlanacaktır.**

Yani:

- Kullanıcı elle token girmeyecek.
- Token/credential kod içine veya config dosyasına yazılmayacak.
- Bağlantı, Meta'nın resmi OAuth akışı üzerinden yapılacak.
- Bağlantı sonrası kullanıcı panelde şunları seçebilecek:

```text
Meta Business
Ad Account
Facebook Page
Instagram Account
Pixel / Dataset
Catalog
```

- Bağlantı durumu, verilen izinler ve eksik izinler panelde görünür olacak.
- Bağlantı panelden kesilebilecek (disconnect).

### 21.5 İkinci Tur Kararlar — 2026-08-12 (`ARCHITECTURE-REPORT.md` sorularının cevapları)

- **Hedef pazar:** Sabit değil — kullanıcı hedef pazarı seçebilecek. (Sonuç: para birimi, reklam dili ve rakip verisi kaynağı pazar seçimine göre davranmalı.)
- **Ajans / white-label:** MVP'de yok. Herkes kendi markasını yönetir. White-label ve ajans hesapları sonraki faz.
- **Onboarding:** Davet ile. Davetler **internal admin panelden** açılır; self-serve signup şimdilik kapalı. (Yeni gereksinim: internal admin panel — tenant/davet yönetimi.)
- **Rakip reklam saklama:** Kopya değil — **referans (URL/metadata) + yapılandırılmış analiz** olarak saklanacak.
- **Landing teması:** Landing, tema seçiminden bağımsız **hep dark**. Panel dark + light. (§22.1 çözüldü.)
- **Tasarım sistemi:** **Ortak semantic token katmanı + iki skin** (landing/panel). (§22.4 çözüldü.)
- **Insufficient Data davranışı:** Onaylandı — verisiz markada tahmin ekranı sayı üretmez. (§22.3'ün veri kaynağı seçimi hâlâ açık.)
- **Bütçe kartları:** Agency/Freelancer kıyas kartları yerine **conservative / recommended / aggressive** senaryo kartları onaylandı. (§22.3 kart sorusu çözüldü.)
- **Para birimi:** Kullanıcı panel para birimini seçebilecek; dönüşümler **anlık kur** üzerinden gösterilecek. (Kur kaynağı seçilecek — açık soru. Meta faturalaması ad account para biriminde kalır; panel çevrimi bilgilendirme amaçlıdır.)
- **Stack:** `ARCHITECTURE-REPORT.md` Bölüm 4 onaylandı — TS monorepo, Next.js, Node API + worker, Postgres, Redis/BullMQ, S3, modular monolith.
- **Deployment:** Şimdilik **Vercel**; ileride taşınabilir. (Not: worker/queue Vercel'de doğrudan koşmaz — Phase 1'de worker için ek host veya serverless-uyumlu queue kararı gerekecek.)
- **Meta bağlantısı ERTELENDİ (kullanıcı kararı, 2026-08-12 akşam):** Kullanıcı şu an Meta developer hesabı açamıyor. v1'de panel Meta'ya BAĞLANMAZ; bunun yerine **manuel yayın kiti** üretir: kampanyanın tüm ayarları (objective + neden + confidence + alternatif, kitle önerisi, yerleşim, bütçe senaryoları, adım adım Ads Manager kurulum talimatı) + onaylı copy'ler kopyala-yapıştır hazır verilir; kullanıcı reklamı Ads Manager'da kendisi açar. OAuth/publish/Insights ileride eklenecek (HANDOFF §23 koşulları o zaman geçerli olacak). Mock/fake Meta entegrasyonu YOK.
- **Tahmin ekranı veri kaynağı (§22.3 ÇÖZÜLDÜ):** **Meta'nın resmi estimate uçları + markanın kendi geçmiş kampanya verisi.** Uydurma model tahmini ve tenant'lar arası öğrenme KULLANILMAYACAK. Veri yoksa "Insufficient Data". Sonuç: bu ekran bağlı ad account gerektirir → Phase 7 konumu doğru; estimate uçları Phase 0'da güncel dokümandan doğrulanacak.
- **Rakip reklam erişimi (rapor B1):** **Pazar-bazlı hibrit** — hedef pazar Ad Library API kapsamındaysa (muhtemelen EU/UK; Phase 0'da teyit) otomatik çekim; kapsam dışı pazarlarda (ör. TR) kullanıcı Ad Library linki/görsel verir, AI yapılandırılmış analiz üretir.
- **Hesap modeli (rapor A3/A5):** MVP **tek kullanıcı** — publish/bütçe yetkisi hesap sahibinde. Ekip + roller, ajans/white-label fazıyla birlikte sonra.

### 21.6 Ürün Referansı — iyzads

Kullanıcı örnek gösterdi: sistem "iyzads gibi benzer mantıkta" olacak.

```text
Source: iyzads.com/tr
Retrieved: 2026-08-12
Type: vendor site
Reliability: vendor claims (bağımsız doğrulanmadı)
```

- AI destekli tek panel reklam yönetimi (Meta, Google, TikTok, YouTube); e-ticaret KOBİ + ajans/freelancer hedefli.
- Tek tıkla reklam oluşturma, strateji, optimizasyon, tasarım, hedef kitle, SEO, raporlama, katalog.
- Abonelik modeli: Basic / Starter / Premium + 14 gün deneme. (Bizim pricing kararımız hâlâ açık; bu bir sinyal, karar değil.)
- **Bizim farkımız:** rakip istihbaratı + pattern öğrenme + kaynak takipli araştırma katmanı; ilk platform yalnız Meta (CLAUDE.md §34).

---

## 22. DESIGN — CONFLICTS & RISKS

Referanslar onaylandı, ancak **doğrudan uygulanabilir değiller.** Aşağıdaki çelişkiler
implementation'dan önce kullanıcı tarafından çözülmelidir.

### 22.1 Tema çelişkisi

Bölüm 21.3 dark + light tema istiyor. Referanslar bunu desteklemiyor:

| Referans | Kendi spec'i |
|----------|--------------|
| A (NovaAI) | Dark-only. Beyaz tipografi + `drop-shadow` + video üstü glass. Light temada bu sistem çalışmaz. |
| B (Nexora) | Spec **açıkça** "No dark mode — light only" diyor. |
| C (Webfluin) | Dark-only, ham hex renkler (`#0D0D0D`, `#FF5656`). |

Yani üç referansın hiçbiri iki temayı desteklemiyor; ikisi birbirinin tersi.

**Çözülmesi gereken:** Video üstü okunabilirlik light temada nasıl sağlanacak?
(Alternatifler: light temada farklı/daha açık video, overlay katmanı, veya landing'in
tema seçiminden bağımsız olarak dark kalması.) **Kullanıcı kararı gerekiyor.**

### 22.2 Üçüncü taraf asset riski

Referanslardaki asset'ler bu projeye ait değildir:

- İki video: `d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/...`
- Bir portre: `images.higgs.ai` proxy üzerinden aynı CDN

Riskler:

- Başka bir hesabın CDN'ine hotlink — her an erişilemez olabilir
- Kullanım/lisans durumu bilinmiyor
- Portre "Mitha, co-founder" olarak sunuluyor — **gerçek olmayan bir kurucu fotoğrafı
  canlı üründe kullanılamaz.** (bkz. `CLAUDE.md` Bölüm 31 — No Dark Patterns)

**Karar:** Bu asset'ler yalnızca prototip/geliştirme aşamasında yer tutucu olarak
kullanılabilir. Public deploy öncesi kendi asset'lerimizle değiştirilecektir.

### 22.3 Calculator = performans tahmini — EN KRİTİK ÇELİŞKİ

Kullanıcının Referans C için tanımladığı kullanım:
*"kaç TL harcarsan ne kadar etkileşim alacağını ortalama gösteren bir yer"*

Bu ekran bir fiyat hesaplayıcısı değil, **performans tahmini** üretir.

Referans C'nin formülleri (`base=399`, `perPage=100`, `8000 + (pages-1)*1000` vb.)
tamamen uydurma sayılardır. Bir web sitesi satış sayfası için sorun değil;
**reklam performansı tahmini için kullanılması bu projenin kendi kurallarını ihlal eder:**

- `CLAUDE.md` Bölüm 6 — CTR, CPC, CPA, ROAS, audience size, benchmark uydurma yasak
- `CLAUDE.md` Bölüm 28 — yetersiz veride "Insufficient Data" göster
- `CLAUDE.md` Bölüm 31 — sahte performans gösterme, belirsizliği gizleme

**Bu ekran için veri kaynağı seçilmeden yazılamaz.** Olası kaynaklar:

1. **Meta'nın resmi delivery/reach estimate uçları** — güncel dokümantasyondan
   doğrulanmalı; bağlı ad account gerektirir; genelde reach tahmini verir, "etkileşim" değil
2. **Markanın kendi geçmiş kampanya verisi** — yalnızca daha önce reklam verdiyse çalışır
3. **Platform genelinde toplu öğrenme** — tenant'lar arası veri kullanımı; gizlilik ve
   rıza sorunu doğurur, ayrıca soğuk başlangıç problemi devam eder
4. **Saf model/heuristic tahmin** — yalnızca açıkça `ESTIMATE` etiketiyle, metodoloji ve
   güven aralığı gösterilerek

Yeni markada hiçbir veri yoksa ekran sayı uydurmak yerine **"Insufficient Data"** göstermelidir.

**Ayrıca:** Referans C'deki "Agency / Freelancer / Bizim fiyat" karşılaştırma kartları
rakip küçültme desenidir. Yerine `HANDOFF.md` Bölüm 10'daki
**conservative / recommended / aggressive** bütçe senaryoları önerilir — üç kartlık
layout buna birebir oturur. **Kullanıcı onayı gerekiyor.**

**Para birimi:** Kullanıcı TL'den bahsetti, referans `$` kullanıyor, Meta ad account'un
kendi para birimi var. Çoklu para birimi ve dönüşüm politikası belirlenmeli.

### 22.4 İki farklı tasarım dili

Referans A (dark, Inter, sinematik) ile Referans B (light, Instrument Serif, ferah SaaS)
aynı sistem değildir. Landing ile panelin ayrı görsel diller olması meşru bir tercihtir,
ancak bilinçli olmalıdır.

**Kullanıcıya sorulacak:** Ortak token katmanı üzerine iki "skin" mi, yoksa tamamen
ayrı iki tasarım sistemi mi?

### 22.5 Referanslar bir design system değildir

Üç referans da pazarlama sayfası veya statik önizlemedir. Gerçek panelde gereken ve
hiçbir referansta bulunmayanlar:

form state'leri, validation ve hata mesajları, boş durumlar (empty state), loading/skeleton,
modal ve drawer, toast/bildirim, veri tabloları (sıralama, filtreleme, sayfalama),
tarih aralığı seçici, çok adımlı wizard (marka oluşturma, Meta bağlama),
onay ekranları (creative approval, campaign publish), erişilebilirlik ve klavye navigasyonu.

Reklam paneli **veri yoğun** bir arayüzdür; Referans B'nin ferah pazarlama estetiği
gerçek tablolarla test edilmeden benimsenmemelidir.

---

## 23. META CONNECTION — CRITICAL CONSTRAINT

**Bu bölüm bir risk uyarısıdır, karar değildir. Implementation öncesi Meta'nın güncel resmi dokümantasyonundan doğrulanmalıdır.**

Bölüm 21.4'teki karar — yani her müşterinin kendi Meta Business hesabını panele bağlaması — bu projedeki **en büyük teknik ve süreçsel engeldir.**

Sebebi: Kendi reklam hesabını yönetmek ile **başkalarının** reklam hesaplarını bir uygulama üzerinden yönetmek Meta tarafında aynı şey değildir. İkincisi genel olarak şunları gerektirir:

- Meta App oluşturma
- Business Verification
- App Review süreci
- Reklam yönetimi için advanced access izinleri
- Platform kullanım şartlarına uyum
- Muhtemelen Tech Provider / partner statüsü

Bu sürecin:

- ne kadar süreceği
- hangi izinlerin gerekeceği
- hangi belgelerin isteneceği
- başvurunun kabul edilip edilmeyeceği

şu an **bilinmemektedir ve uydurulmamalıdır.**

**Zorunlu ilk adım:** Kod yazılmadan önce Meta'nın güncel resmi dokümantasyonu okunacak, gereken izin listesi ve App Review gereksinimleri çıkarılacak, kullanıcıya sunulacaktır.

Bu doğrulanmadan:

- Meta OAuth akışı yazılmayacak
- Campaign publisher yazılmayacak
- Multi-tenant Meta token mimarisi finalize edilmeyecek

**Bu konuda mock/fake entegrasyon yazmak yasaktır (bkz. CLAUDE.md — Bölüm 33).**

---

## 24. FINAL HANDOFF INSTRUCTION

Şimdi repository'yi incele.

**Kod yazma.**

Bana şu formatta bir rapor hazırla:

1. Product understanding
2. What you think the platform should do
3. Current repository state
4. Suggested architecture
5. Core modules
6. Data that needs to be stored
7. Meta integration requirements
8. Research architecture
9. Competitor intelligence architecture
10. Creative generation architecture
11. Campaign architecture
12. Analytics architecture
13. Optimization architecture
14. Security risks
15. Legal/privacy considerations
16. Missing features you identified
17. Questions I need to answer
18. Decisions requiring my confirmation
19. Proposed development phases
20. What you explicitly will NOT build yet

**DO NOT IMPLEMENT ANYTHING UNTIL I ANSWER THE QUESTIONS AND CONFIRM THE ARCHITECTURE.**

---

## 25. SUGGESTED FIRST PROMPT — NEW SESSION

Yeni bir Claude Code oturumu açıldığında ilk mesaj olarak şu kullanılabilir:

```text
Bu projeyi devral.

Önce şu üç dosyayı oku:
CLAUDE.md
HANDOFF.md
DESIGN-REFERENCES.md

Kod yazma.

Repository'de kod yok, sadece bu üç dosya var — bunu doğrula.

Bölüm 21'deki onaylanmış kararlar geçerlidir, tekrar sorma:
- SaaS / B2B, multi-tenant
- Meta bağlantısı panel üzerinden OAuth ile
- Üç tasarım referansı ve kullanım yerleri
- Dark + light tema

Bölüm 22'deki tasarım çelişkilerini ve Bölüm 23'teki Meta App Review
kısıtını ciddiye al. Özellikle 22.3 — bütçe/etkileşim tahmini ekranı
gerçek bir veri kaynağı seçilmeden yazılamaz.

Bana Bölüm 24'te istenen 20 başlıklı raporu hazırla.

Rapor sonunda cevaplamam gereken soruları kategorize edilmiş
ve öncelik sırasına konmuş şekilde ver.

Ben cevaplamadan ve mimariyi onaylamadan hiçbir şey implement etme.
```

### Yeni oturumda hatırlatılacaklar

- Meta izin/App Review gereksinimleri güncel resmi dokümantasyondan doğrulanmalıdır,
  hafızadan yazılmamalıdır (Bölüm 23).
- Tasarım referansları görsel yöndür; marka, copy ve asset'ler bu projeye uyarlanacaktır.
- Referanslardaki video/portre asset'leri üçüncü tarafa aittir, public deploy öncesi
  değiştirilmelidir (Bölüm 22.2).
- Bütçe → tahmini etkileşim ekranı, veri kaynağı netleşmeden implement edilmeyecektir (Bölüm 22.3).

### Hâlâ açık sorular (güncelleme: 2026-08-12, ikinci tur sonrası)

**P0 — kalan bloker: YOK.** Tüm P0 soruları 2026-08-12'de cevaplandı (bkz. 21.5). Mimari onaylandı; sıradaki adım Phase 0 (Meta doğrulama dökümü).

**P1 (güncelleme: Phase 0 sonrası — bkz. `PHASE0-META-VERIFICATION.md`):**

- ~~AI sağlayıcıları~~ → KARAR (dev fazı, "free en iyisini bul" talimatıyla): Gemini (AI Studio, LLM+görsel) + Groq (hızlı/toplu); video MVP'de yok; production öncesi yeniden değerlendirilecek.
- ~~Kur kaynağı~~ → ÖNERİ: Frankfurter (ECB, keysiz); günlük kur — "anlık" değil; TRY kapsamı Phase 1'de teyit.
- Kullanıcı aksiyonu bekleniyor: Meta developer hesabı + app + test varlıkları, AI Studio/Groq key'leri (`PHASE0-META-VERIFICATION.md` §4 checklist).
- Hâlâ açık: F1 (Business Verification için şirket — App Review'a kadar blokör değil), G1/G2 (panel dili + copy dilleri; Phase 1 panel TR yazıldı, copy dili marka başına seçiliyor — EN panel gerekirse i18n sonra eklenecek).
- Yeni açık sorular (Phase 1 sonrası): ürün adı ("AdScore" klasör adından yer tutucu olarak kullanıldı — gerçek marka adı?), git init + commit izni.

**P2:**

- Pricing modeli + billing sağlayıcısı + MVP'de billing olup olmayacağı (rapor H1–H3)
- Bildirim kanalları, veri saklama süresi, tenant'lar arası öğrenme opt-in politikası (rapor I1–I3)
