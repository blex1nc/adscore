# ARCHITECTURE DISCOVERY REPORT

**Tarih:** 2026-08-12
**Durum:** ONAY BEKLİYOR — Bu rapor bir öneridir. Bölüm 17'deki sorular cevaplanmadan ve Bölüm 18'deki kararlar onaylanmadan hiçbir şey implement edilmeyecektir.
**Kaynak dosyalar:** `CLAUDE.md`, `HANDOFF.md`, `DESIGN-REFERENCES.md`

---

## 1. PRODUCT UNDERSTANDING

Platform, bir markanın Meta reklam sürecinin tamamını tek AI destekli sistemde birleştirir:

```text
Marka → Araştırma → Rakip/Reklam istihbaratı → Pattern → Markaya özel strateji
→ AI creative üretimi → Kullanıcı onayı → Kampanya planı → Bütçe → Onay
→ Meta'da yayın → Performans → Analiz → Optimizasyon önerisi → Öğrenme
```

Temel ilkeler (onaylı):

- **B2B SaaS, multi-tenant.** Her müşteri kendi workspace'inde, workspace birden fazla marka barındırabilir.
- **Meta bağlantısı panel üzerinden resmi OAuth ile.** Elle token girilmez.
- **AI hiçbir zaman kullanıcı onayı olmadan para harcamaz.** Publish/activate/budget değişikliği explicit approval ister.
- **Rakipten kopya değil, pattern öğrenme.** Observed Pattern ↔ AI Hypothesis ayrımı, her çıkarımda confidence.
- **Veri uydurma yasak.** CTR/CPC/CPA/ROAS/benchmark uydurulamaz; veri yoksa "Insufficient Data".
- Dark + light tema; üç tasarım referansı (A=landing, B=panel, C=bütçe ekranı) görsel yön olarak onaylı.

## 2. WHAT THE PLATFORM SHOULD DO

Kullanıcının perspektifinden dört ana değer:

1. **Anlama:** Markayı ve niche'i otomatik araştırır, rakipleri keşfeder, rakip reklamlarını yapılandırılmış şekilde analiz eder.
2. **Üretme:** Pattern'lerden markaya özel strateji ve creative üretir; kullanıcı approve/reject/regenerate/edit yapar.
3. **Yayınlama:** Kampanya proposal'ı preview eder, bütçeyi kullanıcıdan alır, onay sonrası Meta'da oluşturur.
4. **Öğrenme:** Performansı izler, evidence + hypothesis + confidence formatında teşhis koyar, önerileri onaya sunar, marka bazında learning biriktirir.

Otomasyon default'ları: `Auto Publish = OFF`, `Auto Budget Change = OFF`, `Auto Campaign Activation = OFF`.

## 3. CURRENT REPOSITORY STATE

Doğrulandı (2026-08-12):

- **Proje kodu yok. Git repo değil. Dependency yok.**
- Dosyalar: `CLAUDE.md` (kurallar), `HANDOFF.md` (ürün + kararlar + riskler), `DESIGN-REFERENCES.md` (üç referansın tam spec'i).
- `.claude/` (settings.local.json), `.agents/skills/` (kurulu Claude Code skill'leri: browser, tasarım, araştırma araçları) ve `skills-lock.json` → Claude Code tooling'i, proje kodu değil.

## 4. SUGGESTED ARCHITECTURE — ONAY GEREKTİRİR

**Öneri: TypeScript monorepo + modular monolith + worker process.** Mikroservis değil; katmanlar modül sınırı olarak korunur, gelecekte ayrıştırılabilir.

```text
apps/
  web        → Next.js (React + TS + Tailwind) — landing + panel
  api        → Node/TS API (tek deployable)
  worker     → Job runner (research, creative gen, Meta sync, publish)
packages/
  ui         → Design system (semantic token katmanı, dark+light)
  core       → Domain modelleri, shared types
  ai         → AI provider abstraction (Anthropic/OpenAI/... adapter)
  meta       → Meta entegrasyon modülü (tüm Graph/Marketing API çağrıları TEK yerde)
```

**Altyapı önerisi:**

| Katman | Öneri | Neden |
|---|---|---|
| Database | PostgreSQL | Multi-tenant ilişkisel veri + JSONB (araştırma çıktıları, ad analizi) |
| Tenant izolasyonu | Shared DB, her satırda `workspace_id` + Postgres RLS | Maliyet/karmaşıklık dengesi; RLS ikinci savunma hattı |
| Queue | Redis + BullMQ | Uzun süren job'lar (research, creative gen, insights sync) API'den ayrılmalı |
| Storage | S3-uyumlu object storage | Brand asset + üretilen creative dosyaları |
| Auth | Managed auth (ör. Auth.js/Clerk/benzeri) — karar Bölüm 17 | Kendi şifre altyapısını yazmamak |
| Secrets | Env + KMS/secret manager; Meta token'ları DB'de app-level encryption ile | CLAUDE.md §32 |

Gerekçeler: Referanslar zaten React + Tailwind + shadcn dünyasında; tek dil (TS) tüm katmanlarda; job-queue mimarisi araştırma/üretim/sync işlerinin doğası gereği zorunlu.

**Alternatifler (istenirse):** Backend'de Python (AI ekosistemi avantajı, ama iki dil maliyeti); ayrı BFF; serverless-only (uzun job'lar için uygun değil). Önerim yukarıdaki yapı. **Confidence: Medium-High.**

## 5. CORE MODULES

Ürün modülleri (HANDOFF §3) + platform modülleri:

```text
ÜRÜN                          PLATFORM (kullanıcının istemediği ama zorunlu)
├── Brand Management          ├── Auth & Tenancy (workspace, kullanıcı, roller)
├── Research Engine           ├── Meta Connection Manager (OAuth, token, izin durumu)
├── Ad Intelligence           ├── Job Queue & Scheduler
├── Creative Studio           ├── Audit Log + AI Decision Log
├── Campaign Builder          ├── Notification sistemi
├── Meta Integration          ├── Usage & Cost Tracking (AI + API maliyeti)
├── Analytics                 ├── Billing (sağlayıcı TBD)
└── Optimization & Learning   └── Admin/observability
```

## 6. DATA THAT NEEDS TO BE STORED

Schema finalize edilmeyecek (HANDOFF §16); bu yalnızca envanter:

- **Tenancy:** workspace, user, membership, role, invitation
- **Brand:** profile, website, sosyal hesaplar, ürün/servisler, voice, assets, guidelines
- **Research:** research_run, source (url, retrieved_at, type, reliability, used_for — CLAUDE.md §37), fact/entity çıkarımları, hypothesis (+confidence)
- **Competitor:** competitor (kategori: direct/indirect/aspirational/creative), competitor_ad (structured analiz, HANDOFF §6 şeması), pattern (observed/hypothesis/confidence)
- **Strategy:** messaging pillars, hooks, angles, offers, testing matrix
- **Creative:** creative (tip, format, copy alanları, asset ref, versiyon, approval state, üreten prompt/karar logu)
- **Campaign:** campaign_proposal, budget girdisi, approval kaydı, Meta entity eşlemesi (campaign/adset/ad/creative ID'leri), guardrail limitleri (§23 CLAUDE.md)
- **Meta connection:** bağlantı, seçilen business/ad account/page/IG/pixel/catalog, izin listesi, token (şifreli), durum
- **Analytics:** metric snapshot time-series (spend, imp, reach, freq, CTR, CPC, CPM, funnel, CPA, ROAS), sync log
- **Optimization:** diagnosis, recommendation (evidence/hypothesis/confidence), user karar, learning kaydı (sample size ile)
- **Platform:** audit_log, ai_decision_log, usage/cost kaydı, notification

## 7. META INTEGRATION REQUIREMENTS

### Resmi dokümandan doğrulananlar (Retrieved: 2026-08-12)

**Kaynak:** developers.facebook.com/docs/marketing-api/overview/authorization — güvenilirlik: resmi

- Marketing API iki seviye: **Limited Access** (default) ve **Full Access** (App Review gerekir).
- **Full Access koşulları:** son 15 günde ≥500 başarılı Marketing API çağrısı + son 500 çağrıda hata oranı <%15 + App Review.
- **Limited Access:** sınırsız ad account yönetebilir ama ad account başına ağır rate limit; Meta'nın ifadesiyle *development only, canlı reklamveren çalıştıran production app'ler için değil*. 1 system user + 1 admin system user.
- İzinler: `ads_management` (okuma+yönetim), `ads_read` (yalnız rapor).
- Hassas veri erişiminde **Business Verification** gerekebilir.

**Kaynak:** developers.facebook.com/docs/app-review — güvenilirlik: resmi

- App Review, uygulama **rolü olmayan kullanıcılara** açılacaksa zorunlu. Onaysız izinler yalnızca app'te rolü olan kullanıcılarda çalışır.
- Meta review sırasında app'i fiilen test eder; test edilemezse başvuru tümden reddedilir.
- Süre/başarı garantisi verilmiyor — **bilinmiyor, uydurulmayacak.**

### Bunun mimariye doğrudan etkisi

1. **Geliştirme App Review'suz başlayabilir:** Limited Access + kendi test ad account'umuz + app'te rolü olan kullanıcılar ile tüm akış geliştirilebilir. SaaS müşterilerine açılış Full Access'e bağlı.
2. **500-çağrı koşulu tavuk-yumurta yaratır:** Full Access başvurusu için gerçek API trafiği gerekir → Phase planında "kendi hesabında yoğun kullanım" dönemi bilinçli olarak App Review öncesine konmalı.
3. App Review başvurusu screencast + gerçek çalışan ürün ister → publish akışı test hesabında bitmiş olmalı.

### Hâlâ doğrulanması gerekenler (Phase 0 işi)

- `business_management`, `pages_*`, `instagram_*`, `catalog_management` izinlerinin bu ürün için tam listesi
- Tech Provider / partner statüsü gerekip gerekmediği
- Reach/delivery estimate uçlarının güncel durumu (22.3 için seçenek 1)
- Insights API alan/attribution detayları, rate limit sınıfları, token yenileme stratejisi

## 8. RESEARCH ARCHITECTURE

```text
Girdi (marka + website + sosyal)
→ Kaynak toplama (yalnız izinli/public: site, sosyal, review, Ad Library web arayüzü)
→ Extraction (facts, entities) → Niche/market analizi → Hypothesis (+confidence)
→ Kayıt: her fact'e source + retrieved_at + reliability
```

- Worker'da job olarak koşar; adım adım ilerleme paneline yansır.
- Her araştırma bir `research_run` snapshot'ıdır — eski araştırma yeni gibi sunulmaz (CLAUDE.md §38).
- AI maliyeti run bazında ölçülür (CLAUDE.md §43); kullanıcıya Estimated AI Cost gösterilebilir.
- **Yetkisiz scraping yok.** Erişim engeli aşılmaz; kaynak yoksa "Bu bilgi mevcut değil."

## 9. COMPETITOR INTELLIGENCE ARCHITECTURE

Akış: keşif (research'ten aday + kullanıcı girdisi) → kategorileme (direct/indirect/aspirational/creative) → reklam araştırması → structured analiz (HANDOFF §6 JSON şeması) → pattern detection (çoklu rakip/reklam, tek reklamdan strateji çıkarılmaz) → Observed/Hypothesis/Confidence ayrımı.

### ⚠️ KRİTİK KISIT — Ad Library kapsamı

İkincil kaynaklara göre (resmi doğrulama Phase 0'da yapılacak; Retrieved: 2026-08-12, güvenilirlik: **ikincil — blog/rehber**):

- Ad Library **API** politik/sosyal konu reklamlarını döner; **ticari reklamlar API'de yalnızca EU/UK hedefli sorgularda** (`ad_type=ALL`) mevcut — DSA zorunluluğu nedeniyle.
- Ticari reklamlarda alan seti politik reklamlardan daha dar.
- Ad Library **web sitesi** tüm aktif reklamları gösterir, ancak otomatik scraping platform şartlarına aykırı → CLAUDE.md §10 gereği yapılmayacak.

**Sonuç:** Hedef pazar Türkiye ise rakip ticari reklamlarına **resmi programatik erişim muhtemelen yok.** Bu, Ad Intelligence modülünün kapsamını belirleyen en kritik üründür kararıdır → Soru B1 ve B2. Seçenekler: (a) EU/UK pazarları için API, (b) kullanıcının manuel Ad Library linki/screenshot girmesi + AI analizi, (c) lisanslı üçüncü taraf veri sağlayıcı (maliyet + doğrulama gerekir), (d) modül kapsamını daraltmak.

## 10. CREATIVE GENERATION ARCHITECTURE

- **Girdi:** brand profile + assets + strategy + patterns + offer + objective. **Çıktı:** concept, copy (primary/headline/description/CTA), image prompt → görsel, video prompt → video (sağlayıcı kararına bağlı).
- `packages/ai` provider abstraction: LLM, image, video ayrı adapter; sağlayıcı hard-code edilmez (CLAUDE.md §36), overengineering'siz.
- Üretim pipeline'ı worker'da; her creative versiyonlanır, üreten karar `ai_decision_log`a yazılır.
- **Approval zorunlu:** approve / reject / regenerate / edit durum makinesi; onaysız creative hiçbir kampanyaya giremez.
- Rakip asset'i (logo, metin, görsel) hiçbir üretimde kullanılmaz — competitor-inspired strategy, clone değil (CLAUDE.md §13).

## 11. CAMPAIGN ARCHITECTURE

```text
DRAFT → PROPOSAL (objective, structure, audience, placements, optimization event,
                  budget senaryoları, testing plan, risks)
→ BUDGET INPUT (kullanıcıdan; daily/lifetime + currency + duration)
→ PREVIEW (Meta'da oluşturulacak her şeyin dökümü)
→ USER APPROVAL ("Approve & Publish")
→ PUBLISH (Meta hiyerarşisi: Campaign → Ad Set → Ad → Creative; PAUSED oluşturma tercihi ayrıca sorulacak)
→ LIVE / FAILED (hata Meta mesajıyla açık gösterilir, CLAUDE.md §42)
```

- "Best settings" mutlak değil: her öneri Reason + Confidence + Alternative ile (CLAUDE.md §18).
- Guardrail'ler: max daily budget, max artış/azalış, auto-pause opsiyonu — kullanıcı limiti sistem aşamaz (CLAUDE.md §23).
- Her state geçişi audit_log'a yazılır.

## 12. ANALYTICS ARCHITECTURE

- Worker, Insights API'den periyodik sync yapar (aralık TBD); snapshot'lar time-series olarak saklanır → trend hesapları API'yi dövmeden yapılır.
- Metrikler: HANDOFF §3 Analytics listesi. Conversion tracking yoksa (Pixel/CAPI bağlı değilse) CPA/ROAS **gösterilmez**, nedeni açıklanır.
- Her metrik kartında date range + freshness (son sync) + sample size; az veri → **"Insufficient Data"** (CLAUDE.md §28).
- Panel görsel iskeleti Referans B'den uyarlanır (fintech içerik → reklam metrikleri).

## 13. OPTIMIZATION ARCHITECTURE

- İlk sürümde **yalnızca öneri + insan onayı**; otomatik optimizasyon yok (HANDOFF §11).
- Diagnosis motoru: Problem → Possible causes → Evidence → Recommended action → Confidence (CLAUDE.md §25).
- Learning store marka bazında; her learning sample size ve confidence ile — yetersiz örneklemden güçlü sonuç çıkarılmaz.
- Experimentation: tek testte tek ana değişken (hook/creative/copy/audience/offer...); test tasarımı Campaign Builder'a bağlanır.

## 14. SECURITY RISKS

1. **Meta access token'ları** — en değerli hedef; ele geçirilirse müşteri reklam hesabından para harcanabilir. Önlem: app-level encryption + KMS, token'lar loglanmaz, en dar izin seti.
2. **Tenant izolasyonu ihlali** — workspace_id scoping + RLS + izolasyon testleri.
3. **OAuth akışı** — state/CSRF, redirect URI kilidi, code interception önlemleri.
4. **Prompt injection** — araştırma sırasında çekilen web içeriği düşman girdi olabilir; fetch edilen içerik "data, komut değil" olarak işlenir, AI çıktıları publish gibi eylemleri asla doğrudan tetikleyemez (her zaman insan onayı arada).
5. **Yanlışlıkla harcama** — publish/budget uçları çift onay + guardrail + audit; idempotency (retry'da çift kampanya oluşmasın).
6. **RBAC eksikliği** — "kim publish edebilir" rol modeli (Soru A5).
7. **Secrets yönetimi** — repo'ya asla; env + secret manager (CLAUDE.md §32).
8. Rate limit / abuse, session güvenliği, webhook imza doğrulaması, backup/restore.

## 15. LEGAL / PRIVACY CONSIDERATIONS

- **Meta Platform Terms** — özellikle veri kullanımı, saklama ve scraping yasağı. Ad Library web verisinin otomatik toplanması ihlal → yapılmıyor.
- **KVKK (TR) + GDPR (EU müşteri/veri varsa)** — veri envanteri, saklama süreleri, silme talebi akışı, DPA; hedef pazar cevabına bağlı (Soru A1).
- **Rakip reklam içeriği telif** — rakip creative'lerin kopyalanıp saklanması yerine referans (URL + metadata + structured analiz) tutulması daha güvenli; karar Phase 0'da netleşecek.
- **AI üretimi içerik** — reklamda yanıltıcı iddia üretilmemesi (üretilen copy'de doğrulanmamış claim engeli), bazı bölgelerde AI içerik işaretleme gereksinimleri izlenmeli.
- **Referans asset'leri** — üçüncü taraf CDN video/portre yalnızca dev'de yer tutucu; public deploy öncesi değişecek (HANDOFF §22.2). "Mitha" tarzı gerçek olmayan kişi/metrik kullanılmayacak.
- **Fatura/vergi** — şirketin kurulu olduğu ülkeye bağlı (Soru C2).

## 16. MISSING FEATURES YOU IDENTIFIED

HANDOFF §18 listesine ek olarak tespit ettiklerim (hiçbiri onaysız yapılmayacak):

1. **Meta bağlantı sağlığı:** token süresi dolunca/izin kaldırılınca panelde "reconnect" akışı + bildirimi — canlı kampanya varken bağlantı kopması kritik.
2. **Spend anomali alarmı:** guardrail'den bağımsız "beklenmedik harcama hızı" uyarısı.
3. **Onboarding wizard'ları:** marka oluşturma ve Meta bağlama çok adımlı sihirbazları (referanslarda yok, §22.5).
4. **Currency & timezone politikası:** ad account para birimi ↔ panel gösterimi; raporlama saat dilimi.
5. **Dil stratejisi:** panel dili (TR/EN?) ve üretilen reklam copy dili ayrı kararlar.
6. **Demo/sandbox modu:** satış-demo ihtiyacı doğarsa yalnızca açıkça `MOCK` etiketiyle (CLAUDE.md §33).
7. **Export/rapor:** PDF/CSV performans raporu (ajans senaryosunda müşteriye rapor ihtiyacı).
8. **Soft delete + geri alma:** marka/creative/kampanya taslağı yanlış silmeye karşı.
9. **Creative asset hak yönetimi:** kullanıcının yüklediği görsellerin kullanım hakkı beyanı.
10. **Webhook'lar:** Meta'dan reddedilen reklam (ad rejected) bildiriminin yakalanması.

## 17. QUESTIONS I NEED TO ANSWER

> Öncelik: **P0** = mimari/ürün kapsamını bloke ediyor · **P1** = Phase 1-2 başlamadan gerekli · **P2** = ilgili faz öncesi yeterli

### A. Business & Tenancy — P0

- **A1. Hedef pazar hangisi?** (Türkiye / EU / global) → Ad Library erişimi (§9), para birimi, KVKK/GDPR kapsamı buna bağlı.
- **A2. Ajans senaryosu var mı?** Bir müşteri birden fazla client markası yönetecek mi? → workspace/brand modeli ve faturalama bundan etkilenir.
- **A3. İlk sürümde team var mı, tek kullanıcı mı?** Ekipse hangi roller? (öneri: Owner / Admin / Member / sadece-görüntüleme)
- **A4. Self-serve signup mı, davetli onboarding mi?**
- **A5. Publish yetkisi kimde?** Her üye mi, yalnız owner/admin mi?

### B. Competitor Intelligence kapsamı — P0

- **B1.** §9'daki kısıt doğrulanırsa (TR ticari reklamlarına API yok), hangi yol? **(a)** EU/UK pazar odağı, **(b)** kullanıcı manuel Ad Library linki/screenshot girer + AI analiz eder, **(c)** lisanslı üçüncü taraf sağlayıcı araştırılsın, **(d)** modül kapsamı daraltılsın.
- **B2.** Rakip reklam görselleri sistemde **kopya olarak saklansın mı, yalnız referans+analiz mi?** (telif riski, §15)

### C. Tasarım kararları — P0 (HANDOFF §22'den, hâlâ açık)

- **C1. Landing light temada nasıl davranacak?** (a) Landing tema seçiminden bağımsız hep dark (önerim — video/glass sistemi bozulmaz), (b) light'ta farklı video + overlay, (c) light'ta videosuz varyant.
- **C2. Ortak token katmanı üzerine iki skin mi (önerim), tamamen ayrı iki tasarım sistemi mi?** (landing=A, panel=B)
- **C3. Tahmin ekranı veri kaynağı — §22.3'teki 4 seçenekten hangisi?** (1) Meta resmi estimate uçları (Phase 0'da doğrulanacak), (2) markanın kendi geçmiş verisi, (3) tenant'lar arası toplu öğrenme (gizlilik/rıza sorunu), (4) açık `ESTIMATE` etiketli model tahmini. Birden fazla seçilebilir; verisiz markada ekran **"Insufficient Data"** gösterecek — onaylıyor musun?
- **C4.** Referans C'deki Agency/Freelancer kartları yerine **conservative / recommended / aggressive** bütçe senaryosu kartları — onaylıyor musun?
- **C5. Para birimi politikası:** Panel TL mi gösterecek, ad account para birimi mi esas? Dönüşüm gösterilecek mi?

### D. Mimari & Stack — P0

- **D1.** Bölüm 4'teki öneri (TS monorepo, Next.js, Node API+worker, Postgres, Redis/BullMQ, S3) onaylanıyor mu?
- **D2. Deployment tercihi var mı?** (Vercel + managed DB / AWS / Hetzner / fark etmez → önerip geçeyim)

### E. AI Sağlayıcıları — P1

- **E1. LLM:** Öncelikli sağlayıcı? (önerim: Anthropic API; abstraction zaten olacak)
- **E2. Görsel üretim:** Hangi sağlayıcı? Bütçe/kalite tercihi var mı?
- **E3. Video üretim MVP'de var mı,** yoksa Phase 2+ mı? (önerim: MVP'de yok — copy+statik önce)
- **E4. AI maliyet limiti:** workspace başına aylık AI kullanım limiti/kotası olsun mu?

### F. Meta & Hesaplar — P1

- **F1.** Meta App'i açacak **doğrulanabilir bir şirket var mı** (Business Verification için)? Hangi ülkede kurulu?
- **F2.** Geliştirme/test için kullanılabilecek **kendi Meta Business + ad account'un var mı?** (Limited Access fazı bununla koşacak)
- **F3.** İlk müşteri profili belli mi (kendi markaların mı, dış müşteri mi)? App Review zamanlamasını etkiler.

### G. Ürün dili & pazar — P1

- **G1.** Panel arayüz dili: TR mi, EN mi, ikisi de mi?
- **G2.** Üretilecek reklam copy dilleri hangileri?

### H. Billing — P2 (ama pricing yönü P1)

- **H1. Pricing modeli:** seat / workspace / ad spend yüzdesi / AI usage bazlı — hangisine eğilimlisin?
- **H2. Billing sağlayıcısı:** şirketin kurulu olduğu ülkeye bağlı; F1 cevabından sonra öneri sunacağım.
- **H3.** MVP'de billing olacak mı, yoksa ilk müşteriler manuel/fatura ile mi?

### I. Operasyon — P2

- **I1.** Bildirim kanalları: yalnız panel içi mi, e-posta da mı? (öneri: panel + e-posta)
- **I2.** Veri saklama süresi beklentin? (araştırma, metrik, audit)
- **I3.** Tenant'lar arası anonim toplu öğrenme (C3-seçenek 3) uzun vadede istenirse **opt-in** şartıyla mı? (öneri: evet, opt-in + açık beyan)

## 18. DECISIONS REQUIRING MY CONFIRMATION

Sorulardan bağımsız, açık onay istediklerim:

1. **Mimari:** Bölüm 4 stack'i ve modular monolith yaklaşımı (Soru D1 ile aynı).
2. **Faz planı:** Bölüm 19 sıralaması — özellikle "Meta publish'ten önce research/creative fazları" tercihi.
3. **Meta stratejisi:** Limited Access + kendi test hesabıyla geliştirme; App Review başvurusunun Phase 6 sonunda, publish akışı test hesabında kanıtlanmış hâldeyken yapılması; 500-çağrı koşulunun bilinçli olarak bu fazda üretilmesi.
4. **Tahmin ekranı sözleşmesi:** Veri kaynağı seçilmeden ve o kaynak doğrulanmadan bu ekran **yazılmayacak**; verisiz durumda "Insufficient Data" (C3/C4 onayıyla birlikte).
5. **Asset politikası:** Referanslardaki üçüncü taraf video/portre yalnızca dev yer tutucu; public deploy öncesi değişim zorunlu; sahte kişi/metrik hiçbir zaman kullanılmayacak.
6. **Rakip verisi politikası:** Yetkisiz scraping yok; kaynak yoksa modül "veri yok" der, taklit veri üretmez.

## 19. PROPOSED DEVELOPMENT PHASES

Her faz sonunda çalışan bir bütün + faz öncesi CLAUDE.md §46 onay şablonu:

- **Phase 0 — Kararlar & Doğrulama (kod yok):** Bölüm 17 cevapları; Meta resmi dokümanından tam izin listesi + App Review gereksinim dökümü + Ad Library kapsamının resmi teyidi + estimate uçlarının durumu; design token temelleri kararı. **Çıktı:** onaylı mimari + doğrulanmış Meta gereksinim raporu.
- **Phase 1 — Platform iskeleti:** monorepo, auth + workspace + multi-tenant temel, brand CRUD, design system (semantic token, dark+light), panel iskeleti (Referans B uyarlama), landing (Referans A uyarlama, yer tutucu asset).
- **Phase 2 — Research Engine v1:** brand research + source tracking + niche analizi. Meta'dan tamamen bağımsız → App Review'i beklemez.
- **Phase 3 — Competitor Intelligence v1:** kapsam B1 kararına göre; structured ad analizi + pattern detection.
- **Phase 4 — Creative Studio v1:** strateji üretimi + copy + statik görsel (E2 kararına bağlı) + approval workflow + creative library.
- **Phase 5 — Meta bağlantısı (read-only):** OAuth + varlık seçimi (business/account/page/IG/pixel) + Insights sync + Analytics dashboard. Limited Access, kendi test hesabı.
- **Phase 6 — Campaign publish:** planner → proposal → preview → approve → publish (test hesabında) + guardrail'ler + audit. Sonunda App Review başvurusu.
- **Phase 7 — Optimization & Learning + Tahmin ekranı:** diagnosis/öneri döngüsü, learning store; tahmin ekranı ancak C3 kaynağı doğrulanmış ve veri mevcutsa.

Fazlar arası bağımlılık düşük tutuldu; App Review süresi bilinmediği için Meta'ya bağımlı olmayan değer (research + creative) öne alındı.

## 20. WHAT I WILL EXPLICITLY NOT BUILD YET

- Hiçbir kod, package.json, scaffold — mimari onaylanana kadar (bu rapor dahil hiçbir şey implementation değildir).
- Database schema finalize etme.
- Meta OAuth, campaign publisher, token mimarisi — Phase 0 doğrulaması bitmeden (HANDOFF §23).
- **Bütçe → tahmini etkileşim ekranı** — veri kaynağı seçilip doğrulanmadan (HANDOFF §22.3).
- Mock/fake Meta entegrasyonu — yasak (CLAUDE.md §33); eksik entegrasyon `BLOCKED` olarak işaretlenir.
- Scraping sistemi — hiçbir koşulda yetkisiz scraping yok.
- Creative generator finalize, otomatik optimizasyon, billing entegrasyonu, production deployment.
- Referanslardan birebir kopya sayfa (copy/asset/marka uyarlanmadan).

---

**SONRAKİ ADIM:** Bölüm 17'deki soruları (öncelik: A→D P0 blokları) cevaplaman. Cevaplar geldikten sonra Phase 0'ın Meta doğrulama dökümünü çıkarıp implementation planını onayına sunacağım. **O zamana kadar kod yazılmayacak.**
