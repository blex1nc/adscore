# REPORT-B — Yayın Hattı (PAUSED-only)

**Tarih:** 2026-08-24 · **Branch:** `meta/agent-b` (A'nın branch'i merge edilmiş halde)
**Durum:** Kod + testler tamam; **gerçek Meta e2e'si kullanıcı OAuth bağlantısını bekliyor** (aşağıda "BEKLİYOR").

## 1. Yapılanlar

### t=0 (A'yı beklerken)
- **Uç doğrulama:** Kullanılan her Meta ucu resmî dokümandan doğrulandı → `docs/meta/SOURCES-B.md`
  (14 kayıt, retrieved 2026-08-24). Kritik bulgular:
  - **Bütçe birimi:** `daily_budget`/`lifetime_budget`/`bid` tutarları ad account para biriminin
    **minör biriminde** tam sayı. **TRY offset = 100** (250,00 TL → `25000`); offset-1 (ondalıksız)
    para birimleri: CLP, COP, CRC, HUF, ISK, IDR, JPY, KRW, PYG, TWD, VND. 100× hata birim testli.
  - `special_ad_categories` **zorunlu**; kategori yoksa **boş dizi** gönderilir ("NONE" → boş dizi).
  - `object_story_spec`'te güncel IG alanı **`instagram_user_id`**; `instagram_actor_id` alan listesinde YOK
    → binding'deki `instagramActorId` payload katmanında eşleniyor.
  - **v23.0+**: yaş/cinsiyet/detaylı hedefleme kullanılan yeni ad set'te
    `targeting_automation.advantage_audience` (0|1) **açıkça gönderilmek zorunda** — spec hep gönderiyor;
    değer kullanıcı seçimi (varsayılan dayatılmıyor).
  - `delivery_estimate`: Meta güven veremediğinde `daily_outcomes_curve` **boş DEĞİL, "tek nokta hepsi 0"**
    dönebilir — Insufficient Data tespiti iki durumu da kapsıyor.
  - Reklam create sonrası önce `PENDING_REVIEW`, inceleme bitince seçili duruma (PAUSED) döner — UI'da açıklanıyor.
- **Doküman borcu:** `meta-fields.ts`'in referans verdiği kayıp `docs/META-ADS-MANAGER-FIELDS.md` yeniden üretildi.

### Saf katman (`apps/web/src/lib/meta-publish/`)
- `payloads.ts`: `toMinorUnits`/`fromMinorUnits` (string matematiği, offset tablosu),
  `buildCampaignPayload`/`buildAdSetPayload`/`buildCreativePayload`/`buildAdPayload`
  (**status daima "PAUSED" sabit; bid alanı üretilmiyor**), `buildTargetingSpec` (yalnız
  `meta_search` kaynaklı, sayısal ID'li nesneler; advantage bayrağı hep açık gönderilir),
  `resolveOptimization` (doğrulanmış kombinasyonlar: traffic → LINK_CLICKS|LANDING_PAGE_VIEWS;
  sales → OFFSITE_CONVERSIONS + pixel + kullanıcı seçimi event; diğer amaçlar → PublishKit'e dürüst yönlendirme),
  `isCurveInsufficient`, Ads Manager derin linkleri, `assertCurrencyMatch` (plan ≠ hesap para birimi → yayın reddi).
- `stages.ts`: aşama sırası **CAMPAIGN → ADSET → MEDIA → CREATIVE → AD** (ad, creative_id'ye referans verir),
  yetim riski tespiti, adimages cevabı ayrıştırma, `readStoredTargeting` doğrulaması.
- `access.ts`: sahiplik zinciri, plan kapıları (`publishBlockers`), görsel bayt yükleme.
- `run.ts` (B4 çekirdeği): claim'li (Arena deseni, 90 sn bayat eşiği), aşama başına 3 deneme,
  **her aşamada `assertPublishAllowed` + `assertSafePayload`**, her yazım audit'li.
  **Çökme güvenliği:** payload çağrıdan ÖNCE `request.sent`'e yazılır; cevap kaydedilemeden
  kesinti olursa aşama KÖRLEMESİNE tekrarlanmaz — kullanıcı "Ads Manager'ı kontrol ettim" onayıyla sürdürür.
  Kısmi başarısızlıkta oluşan nesneler ID'leriyle dürüstçe listelenir; tekrar deneme mevcut ID'leri atlar.

### Action'lar (`apps/web/src/actions/meta-publish.ts`)
B1 hedefleme arama/kaydetme, B2 delivery estimate, B3+B5 görsel yükleme + `generatepreviews`,
B4 taslak/onay/ilerletme/tekrar. Hepsi `MetaBlockedError` → dürüst BLOCKED zarfı, TR mesajlar.

### UI (`components/publish/*`, `campaigns/[planId]/publish/page.tsx`)
- Hedefleme formu: Meta aramasından ilgi/davranış/ülke seçimi (kaynak + tarih etiketli, kitle
  büyüklükleri Meta'dan), yaş/cinsiyet, Advantage+ açık seçim, **özel reklam kategorisi zorunlu soru**
  ("Hiçbiri" de bilinçli cevap; cevapsızken yayın bloklu).
- Tahmin kartı: yalnız Meta'nın sayıları; eğri noktaları olduğu gibi (ara değer hesaplanmaz);
  boş/0-eğri → "Insufficient Data — Meta bu hedefleme için güvenli tahmin üretmiyor".
- Yayın akışı: seçim → payload özeti önizlemesi (Meta'ya hiçbir şey gitmeden kuru guard koşusu) →
  isteğe bağlı "görseli yükle + resmî önizleme" (açık beyanla; başarısızsa neden + nötr çerçeve yönlendirmesi) →
  **açık onay kutusu** → 3 sn poller ile aşamalar → ID + Ads Manager linkli sonuç ekranı +
  "Yayına almak için Ads Manager'dan sen aktif edeceksin" notu.
- Kampanya listesine tek satır giriş linki (ortak dosya `campaigns/page.tsx`, yalnız link).
- `apps/web/package.json` test script'ine meta-publish test glob'u eklendi (ortak dosya, tek satır).

## 2. Test kanıtları (AGENT-B §5 eşlemesi)

| § | Kanıt | Durum |
|---|---|---|
| 5.3 | **41 birim testi** (`payloads` 31 + `stages` 6 + `guards-path` 4); bütçe birimi (TRY 100 / JPY 1, fazla ondalık reddi), object_story_spec (page_id zorunlu, instagram_user_id eşleme, CTA link eşitliği), PAUSED kırmızı çizgi taraması. Tüm repo: `pnpm test` → **114/114 yeşil**; `tsc --noEmit` + eslint temiz. | ✅ |
| 5.4 | Kod: `requireBrandBinding` → `MetaBlockedError NO_BINDING` ("eksik: ad account, Facebook Page"); `publishBlockers` + `ensureDraft` kapıları; **MetaPublish satırı 0** (hiçbir nesne oluşmadı). UI: 3001'de gerçek login ile publish sayfası **BLOCKED panelini** gösterdi (ekran görüntüsü: scratchpad `publish-blocked.png`); yayın akışı hiç render edilmiyor. | ✅ (bağlantısız yol) |
| 5.5 | Gerçek DB'de **iki eşzamanlı `advancePublish`**: yalnız biri claim alıp aşamayı işledi (bağlantısız ortamda dürüst FAILED), diğeri claim alamadan döndü — çift yürütme yok. (Harness: `apps/web/.data/meta-b-claim.ts`.) | ✅ |
| 5.6 | Guard yolun içinde, birim testli: (a) yasak durumlu payload reddedildi (iç içe dahil), (b) plan bütçesinden sapma + tavansız + tavan aşımı reddedildi, (c) mevcut nesneye status/bütçe/bid güncellemesi reddedildi, (d) gerçek üretici çıktıları geçti (`guards-path.test.ts`, A'nın saf `assertSafePayloadCore`'u ile). | ✅ |
| 5.1 | Gerçek uçtan uca PAUSED oluşturma | ⏳ BEKLİYOR (aşağıda) |
| 5.2 | delivery_estimate dolu/boş gerçek deneme | ⏳ BEKLİYOR |

## 3. BEKLİYOR — gerçek yayın testi (kullanıcı OAuth'u gerekli)

Bağlantı hazır olunca sırasıyla:
1. `/app/settings/meta` → Meta'ya bağlan (A'nın akışı) → markaya **test ad account + Page** (+ varsa IG/pixel) bağla → **günlük bütçe tavanı** gir (tavan yoksa guard bütçeli create'i reddeder — tasarım gereği).
2. Marka planının kampanya listesinden **"Meta'da yayınla (PAUSED)"** → hedefleme seç/kaydet (arama gerçek uçtan) → tahmin al (**dolu ve boş senaryo**: dar hedefleme/az geçmişle Insufficient Data beklenir) → önizlemeyi hazırla → resmî önizleme → onay kutusu → oluştur.
3. Doğrula: Ads Manager'da kampanya + ad set + creative + ad **PAUSED**; ID'ler sonuç ekranı + `MetaPublish` satırı + `CampaignPlan.metaCampaignId/metaAdSetId/metaAdId/metaPublishedAt` dolu; `MetaApiCall` sayaç kayıtları.
4. Çift tıklama canlı testi: sonuç tek kampanya olmalı (claim kanıtı §5.5'te DB seviyesinde mevcut).
5. TOTAL bütçeli planla deneme: guard `lifetime_budget`'ı günlük tavana karşı kontrol eder (A'nın bilinçli güvenli yönü) — tavan < toplam bütçe ise dürüst red mesajı görülmeli.

Test fixture'ları hazır (dev DB): kullanıcı `meta-b-test@ornek.dev` (şifre scratchpad
`meta-test-pass.txt`; ilk değer bir araç hatasıyla transkripte bir kez yansıdı, ardından
rotate edildi — güncel değer yalnız dosyada), marka `cmt7bive00003jin16d3zrnyt`, plan
`cmt7biveg000ajin1jx2mqox7` (COMPLETED, traffic, 250,00 TRY günlük, onaylı creative + görsel).
Harness'lar: `apps/web/.data/meta-b-{fixtures,gates,claim}.ts` (git dışı; koşturma
`NODE_PATH=.data/node_modules node --env-file=.env.local --import tsx <dosya>`).

## 4. A'ya notlar

1. **Guard "asset create" modu:** creative/adimages payload'larında `status` alanı yok; guard'ın
   create modu status=PAUSED zorunlu kıldığından bu çağrıları **katı update moduyla** doğruluyorum
   (status/bütçe/bid tümüyle yasak + iç içe yasak durum taraması — createden daha dar). Guard'a
   "asset" modu eklersen geçeririm; mevcut haliyle de güvenli.
2. **idempotencyKey bilinçli farkım:** create çağrılarında (campaigns/adsets/adcreatives/ads)
   anahtar VERMİYORUM → istemci timeout'ta bile otomatik tekrar denemez (Graph API'de doğrulanmış
   idempotens yok; timeout'ta nesne oluşmuş olabilir → tekrar = çift kampanya). Cevapsız kesintiyi
   kendi yetim akışım yönetiyor. Yalnız `adimages`'ta anahtar var (aynı bayt → aynı hash, tekrar zararsız).
3. `instagramActorId` → payload'da `instagram_user_id` (SOURCES-B §4). A5 varlık seçiminde IG **user id**'sinin yazıldığından emin ol.
4. TOTAL bütçe × günlük tavan semantiğin (lifetime ≤ maxDailyBudget) UI'da guard mesajıyla yüzeye çıkıyor; ileride tavan modelini ayrıştırmak istersen haber ver.
5. CONTRACTS'taki MetaPublish yorumu "campaign → adset → ad → creative" diyor; uygulanan doğru sıra **CAMPAIGN → ADSET → MEDIA → CREATIVE → AD** (`stage` String — şema değişikliği gerekmedi).

## 5. C'ye notlar

- Yayın tamamlanınca `CampaignPlan.metaCampaignId/metaAdSetId/metaAdId/metaPublishedAt` doluyor —
  insights eşlemesi için `externalRef` olarak `metaCampaignId` kullanabilirsin.
- `MetaPublish.request/response` her aşamanın gönderilen payload + Meta cevabını tutuyor (açıklanabilirlik).
- `campaigns/page.tsx`'e yalnız tek satır link ekledim (satır ~211); çakışırsan haber ver.

## 6. Açık kalanlar

- Gerçek e2e (§3) — OAuth sonrası ilk iş.
- OUTCOME_SALES'in ODAX eşleme tablosundaki satırları fetch özetinde verbatim çekilemedi;
  `pixel_id + custom_event_type` gereksinimi AdPromotedObject sayfasıyla çapraz doğrulandı,
  kesin teyit gerçek testte (SOURCES-B §14 dürüstlük notu).
- Awareness/engagement/leads/app_promotion amaçlarının API yayın yolu bilinçli kapalı
  (doğrulanmamış kombinasyon gönderilmez) — sonraki sprintte doğrulanıp açılabilir.
- Video yükleme kapsam dışı (üretim yok); `advideos` ucu SOURCES-B §11'de kayıtlı.
- Not: Görev promptundaki Meta MCP sunucusu bu oturumun araç listesinde görünmedi (ToolSearch ile arandı);
  doğrulama WebFetch ile resmî sayfalardan yapıldı.
