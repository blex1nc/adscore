# REPORT-B — Yayın Hattı (PAUSED-only) — TASLAK, sprint boyunca güncellenir

**Son güncelleme:** 2026-08-24 (t=0 sonrası; A'nın şema commit'i merge edildi, istemci implementasyonu bekleniyor)

## A'YA ACİL NOTLAR (guard/istemci implementasyonundan ÖNCE oku)

1. **Guard bütçe birimi uyuşmazlığı (en kritik):** Benim ad set payload'larım `daily_budget: 25000`
   (minor unit, kuruş) taşır; `plan.budgetAmount` ise `"250.00"` (ondalıklı string). `assertSafePayload`
   bunları naif karşılaştırırsa ya her geçerli payload'ı reddeder ya da yanlışları geçirir.
   Çözüm: offset dönüşümüyle karşılaştır — `apps/web/src/lib/meta-publish/payloads.ts` içindeki
   `toMinorUnits` / `currencyOffset` saf ve import edilebilir; doğrudan kullan (TRY offset 100,
   JPY/HUF vb. offset 1 — SOURCES-B §3).
2. **Status'süz create payload'ları:** creative (`adcreatives`) ve görsel (`adimages`) payload'larında
   `status` alanı YOK. Önerdiğim kural: create + `status` varsa → PAUSED zorunlu; create + `status`
   yoksa → payload'da status/bütçe/bid alanı hiç bulunmamalı. Aksi halde creative aşaması her seferinde reddedilir.
3. **LIFETIME bütçe × maxDailyBudget semantiği tanımsız:** `Workspace.maxDailyBudget` günlük tavan.
   LIFETIME planlarda guard ne yapmalı? Seçenekler: (a) `lifetime/durationDays <= maxDailyBudget`,
   (b) tavan varken lifetime reddi. Sessiz karar vermedim — birini seç ve REPORT-A'ya yaz.
4. **İstemci ihtiyaçlarım (B4/B5):**
   - `post` adimages çağrısında `bytes` (base64) parametresi taşıyabilmeli.
   - `get` çağrısında obje parametreleri JSON string'e çevrilebilmeli (`targeting_spec`, generatepreviews `creative` spec'i).
   - Her yazma çağrısında `idempotencyKey: "<publishId>:<stage>"` göndereceğim.
5. **`instagramActorId` → `instagram_user_id`:** object_story_spec'in güncel alan adı `instagram_user_id`;
   `instagram_actor_id` alan listesinde yok (SOURCES-B §4). Şema alanı `instagramActorId` kalabilir,
   payload katmanında ben eşliyorum. A5 varlık seçiminde IG id'sinin bu alana yazıldığından emin ol.
6. **Stage listesi:** CONTRACTS'taki MetaPublish yorumu "campaign → adset → ad → creative" diyor;
   doğru sıra CAMPAIGN → ADSET → MEDIA → CREATIVE → AD (ad, creative_id'ye referans verir; MEDIA
   benim eklediğim görsel yükleme aşaması — `stage` String olduğundan şema değişikliği gerekmez).
7. **META_API_VERSION v23.0:** Doküman örnekleri v25.0 gösteriyor; v23 desteklenen sürüm ve
   v23+ davranışı (advantage_audience zorunluluğu) bizi kapsıyor. Sürüm senin dosyanda — yükseltirsen haber ver.

## Yapılanlar (şimdiye kadar)

- **t=0 doğrulama:** Kullanılan her uç resmî dokümandan doğrulandı → `docs/meta/SOURCES-B.md`
  (retrieved 2026-08-24). Kritik bulgular:
  - Bütçe/bid tutarları **minor unit** (TRY offset 100 → kuruş; CLP/HUF/JPY... offset 1). 100× hata birim testli.
  - `special_ad_categories` API'de **zorunlu**; kategori yoksa **boş dizi** (UI'da "NONE" cevabı → boş dizi).
  - `object_story_spec` güncel IG alanı **instagram_user_id**.
  - v23.0+: non-default hedeflemede `targeting_automation.advantage_audience` (0|1) **açıkça gönderilmek zorunda**.
  - `delivery_estimate`: güven yoksa `daily_outcomes_curve` = "tek nokta, hepsi 0" → Insufficient Data tespiti buna göre.
  - `generatepreviews` `ad_format` enum'ları teyitli; önizleme 24 saat geçerli.
- **Kayıp doküman borcu kapatıldı:** `docs/META-ADS-MANAGER-FIELDS.md` yeniden üretildi
  (meta-fields.ts referansı artık kırık değil).
- **Saf payload üreticileri + 31 birim testi:** `apps/web/src/lib/meta-publish/{types,payloads}.ts` +
  `__tests__/payloads.test.ts` (tsx --test ile koşuyor; tümü yeşil; `tsc --noEmit` ve eslint temiz).
  - `status: "PAUSED"` üretici çıktısında sabit; yasak durum tipte temsil edilemiyor; kırmızı çizgi testi
    tüm çıktıları tarıyor.
  - Desteklenen amaçlar (bu sprint API yolu): **traffic** (LINK_CLICKS | LANDING_PAGE_VIEWS) ve
    **sales** (OFFSITE_CONVERSIONS + pixel + kullanıcı seçimi custom_event_type). Diğer amaçlar
    PublishKit'e dürüst yönlendirme (doğrulanmamış kombinasyon gönderilmez).
  - Plan para birimi ≠ ad account para birimi → yayın reddi (kur çevrimi bilgilendirme amaçlı, HANDOFF 21.5).

## Bekleyen işler

- B1–B5 implementasyonu (access/run/actions/UI) — sırada.
- Gerçek uçtan uca test: A'nın istemci implementasyonu + kullanıcı OAuth bağlantısı gerekiyor.

## Not (MCP)

Görev promptundaki Meta MCP sunucusu bu oturumun araç listesinde görünmedi (ToolSearch ile arandı);
doğrulama WebFetch ile resmî sayfalardan yapıldı.
