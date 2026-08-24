# SOURCES-B — Ajan B'nin doğruladığı Meta uçları

**Retrieved at (tümü): 2026-08-24.** Kaynaklar resmî `developers.facebook.com` sayfaları (WebFetch ile).
Not: Görev promptu Meta MCP sunucusundan bahsediyordu; bu oturumda MCP araç listesinde Meta aracı **görünmedi** (ToolSearch ile arandı) → doğrulama WebFetch ile yapıldı.
Doküman örnekleri **v25.0** gösteriyor; A'nın istemcisi `META_API_VERSION = "v26.0"` sabitledi (sürüm yalnız A'nın dosyasında; ben kendi dosyalarımda sürüm yazmıyorum). v23.0+ davranış değişiklikleri (advantage_audience zorunluluğu) v26'da da geçerli.

## 1. Kampanya oluşturma
- **Source:** Marketing API Reference — Campaign (`ad-campaign-group`)
- **URL:** https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/
- **Used for:** `buildCampaignPayload`
- **Doğrulanan:**
  - `POST /act_<ID>/campaigns` zorunlu alanlar: `name`, `objective`, `special_ad_categories`.
  - ODAX objective değerleri: `OUTCOME_APP_PROMOTION`, `OUTCOME_AWARENESS`, `OUTCOME_ENGAGEMENT`, `OUTCOME_LEADS`, `OUTCOME_SALES`, `OUTCOME_TRAFFIC` (legacy adlar hâlâ listede ama kullanılmayacak).
  - `special_ad_categories` **zorunlu**: "special_ad_categories parameter is required and accepts an array"; kategori yoksa **boş dizi** gönderilir ("send an empty array"). Değerler: `NONE`, `EMPLOYMENT`, `HOUSING`, `CREDIT`, `ISSUES_ELECTIONS_POLITICS`, `ONLINE_GAMBLING_AND_GAMING`, `FINANCIAL_PRODUCTS_SERVICES`.
  - `status` oluşturma sırasında yalnız `ACTIVE` | `PAUSED`: "Only ACTIVE and PAUSED are valid during creation." PAUSED → çocuk nesneler `CAMPAIGN_PAUSED`.
  - `buying_type` varsayılan `AUCTION`.

## 2. Ad set oluşturma + BÜTÇE BİRİMİ (kritik)
- **Source:** Marketing API Reference — Ad Set (`ad-campaign`)
- **URL:** https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/
- **Used for:** `buildAdSetPayload`, bütçe dönüşümü, tahmin ekranı
- **Doğrulanan:**
  - Zorunlu: `name` (≤400 kr), `campaign_id`, `optimization_goal`, `billing_event`, `targeting` (countries zorunlu), `daily_budget` VEYA `lifetime_budget` (>0).
  - **Bütçe/bid birimi:** "The bid amount's unit is cents for currencies like USD, EUR, and the basic unit for currencies like JPY, KRW." → tutarlar **minor unit** (kuruş/cent) cinsinden tam sayı; istisna offset-1 para birimleri (bkz. §3).
  - `lifetime_budget` ile `end_time` **zorunlu**; `daily_budget` ile opsiyonel.
  - `status` oluşturmada yalnız `ACTIVE` | `PAUSED`.
  - `bid_strategy`: `LOWEST_COST_WITHOUT_CAP` (bid_amount gerekmez), `LOWEST_COST_WITH_BID_CAP`/`COST_CAP` (bid_amount zorunlu — bu sprintte kullanılmaz).
  - Minimum günlük bütçe (LOWEST_COST_WITHOUT_CAP): impressions ~$0.50, clicks/likes/video views ~$2.50, düşük frekanslı aksiyonlar ~$40; bazı ülkelerde 2×. (Yaklaşık — UI'da "Meta minimumun altında kalabilir" uyarısı için.)

## 3. Para birimi offset tablosu (TRY teyidi)
- **Source:** Marketing API — Currencies
- **URL:** https://developers.facebook.com/docs/marketing-api/currencies/
- **Used for:** `toMinorUnits` dönüşümü + birim testleri
- **Doğrulanan:**
  - "If a currency has an offset of 100 then the minimum bid equals 1/100 of the base currency unit."
  - **TRY offset = 100** (USD=100, EUR=100) → 250,00 TL bütçe = `25000` gönderilir. Yanlışı 100× harcama demektir.
  - Offset **1** (ondalıksız) para birimleri: CLP, COP, CRC, HUF, ISK, IDR, JPY, KRW, PYG, TWD, VND → tutar tam birim gönderilir.

## 4. Ad creative + object_story_spec
- **Source:** Marketing API Reference — Ad Creative + AdCreativeObjectStorySpec + AdCreativeLinkData
- **URL:** https://developers.facebook.com/docs/marketing-api/reference/ad-creative/ , https://developers.facebook.com/docs/marketing-api/reference/ad-creative-object-story-spec/ , https://developers.facebook.com/docs/marketing-api/reference/ad-creative-link-data/
- **Used for:** `buildCreativePayload`
- **Doğrulanan:**
  - `POST /act_<ID>/adcreatives`, `object_story_spec` = `page_id` + (`link_data` | `photo_data` | `video_data` | `text_data` | `template_data`).
  - **`page_id` zorunlu** (unpublished page post oluşturur).
  - **Instagram alanı güncel adı `instagram_user_id`** ("The Instagram user account that the ad will be posted to"); `instagram_actor_id` object_story_spec alan listesinde **YOK** → binding'deki `instagramActorId` değeri payload'da `instagram_user_id` olarak gönderilir (A'ya not).
  - `link_data` alanları: `link` (CTA link'iyle aynı olmalı), `message` (ana metin), `name` (başlık: "Name of the link. Overwrite the title..."), `description` (açıklama), `image_hash` (VEYA `picture`, ikisi birden değil), `call_to_action` (`{type, value:{link}}`; verilmezse Instagram'da varsayılan CTA).
  - CTA type enum geniş liste (SHOP_NOW, LEARN_MORE, SIGN_UP, ... 75+ değer) — publish-kit `CTA_BUTTONS` enum'ları geçerli.

## 5. Ad oluşturma
- **Source:** Marketing API Reference — Ad (`adgroup`)
- **URL:** https://developers.facebook.com/docs/marketing-api/reference/adgroup/
- **Used for:** `buildAdPayload`
- **Doğrulanan:**
  - `POST /act_<ID>/ads` zorunlu: `name`, `adset_id`, `creative` ("This field is required for create") — `creative: {"creative_id": "<ID>"}`.
  - `status` oluşturmada yalnız `ACTIVE` | `PAUSED`.
  - Oluşan reklam önce incelemeye girer: "will have the ad status PENDING_REVIEW before it finishes review and reverts back to your selected status" → PAUSED seçtik, inceleme sonrası PAUSED'a döner (UI'da açıklanır).

## 6. Hedefleme arama
- **Source:** Marketing API — Targeting Search
- **URL:** https://developers.facebook.com/docs/marketing-api/audiences/reference/targeting-search/
- **Used for:** B1 hedefleme seçici
- **Doğrulanan:**
  - `GET /<VER>/search` + `type=adinterest` (ilgi), `type=adTargetingCategory&class=behaviors|demographics`, `type=adgeolocation` (konum; `location_types` paramı), `q=<arama>`, `limit` (varsayılan 8).
  - Dönen: `id`, `name`, `audience_size_lower_bound`/`audience_size_upper_bound`, `path`, `type`.
  - Seçilenler targeting spec'te `interests: [{id, name}]` (veya flexible_spec) olarak kullanılır.

## 7. Targeting spec şeması
- **Source:** Marketing API — Targeting Specs
- **URL:** https://developers.facebook.com/docs/marketing-api/targeting-specs/
- **Used for:** `buildTargetingSpec`
- **Doğrulanan:**
  - `geo_locations: { countries: ["TR"], regions: [{key}], cities: [{key, radius, distance_unit}] }`.
  - `age_min` / `age_max` (örnek 18–24), `genders: [1]` erkek / `[2]` kadın / atlanırsa tümü.
  - `interests: [{id, name}]`; `publisher_platforms: ["facebook","instagram",...]`, `facebook_positions: ["feed"]`, `device_platforms`.

## 8. Advantage+ audience bayrağı (v23.0'da davranış değişti — kritik)
- **Source:** Advantage+ Audience referansı + resmi blog duyurusu (2025-06-13)
- **URL:** https://developers.facebook.com/docs/marketing-api/audiences/reference/targeting-expansion/advantage-audience/ , https://developers.facebook.com/blog/post/2025/06/13/marketing-api-changes-to-advantage-plus-audience-behaviors/
- **Used for:** `buildTargetingSpec` — bayrak zorunluluğu
- **Doğrulanan:**
  - Alan: `targeting.targeting_automation.advantage_audience` = `1` | `0`.
  - **v23.0'dan itibaren** yeni ad set oluştururken yaş/cinsiyet/detaylı hedefleme gibi non-default ayar kullanılıyorsa bayrak **açıkça gönderilmek zorunda**; yoksa hata döner. (A'nın istemcisi v26.0 → bizi kapsıyor.)
  - Kullanıcının seçtiği hedeflemeyi aynen korumak için `advantage_audience: 0` gönderilir; `1` seçeneği UI'da kullanıcıya bırakılır (varsayılan dayatılmaz).

## 9. Delivery estimate
- **Source:** Ad Account / Ad Set `delivery_estimate` edge
- **URL:** https://developers.facebook.com/docs/marketing-api/reference/ad-account/delivery_estimate/ , https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/delivery_estimate/
- **Used for:** B2 erişim tahmini ekranı
- **Doğrulanan:**
  - `GET /act_<ID>/delivery_estimate` — zorunlu `optimization_goal`, `targeting_spec`; opsiyonel `promoted_object`.
  - Dönen node: `estimate_ready`, `daily_outcomes_curve`, `estimate_dau`, `estimate_mau_lower_bound`, `estimate_mau_upper_bound`, `targeting_optimization_types`.
  - **Insufficient Data teyidi (PHASE0 §1.5):** "The daily_outcomes_curve field will only have data when we are able to provide high confidence predictions. When we do not have high confidence predictions we will return an array of 1 point with all 0s." → boş DEĞİL, **tek noktalı hepsi-0 eğri** de "veri yok" sayılır; ekran bu iki durumda da Insufficient Data gösterir.

## 10. Görsel yükleme
- **Source:** Marketing API Reference — Ad Image
- **URL:** https://developers.facebook.com/docs/marketing-api/reference/ad-image/
- **Used for:** B3 medya yükleme
- **Doğrulanan:**
  - `POST /act_<ID>/adimages`, dosya `bytes` (form data / base64) ile; dosya adı uzantılı olmalı ("sample.jpg, not sample").
  - Dönen: `hash` (creative'de `image_hash` olarak kullanılır), `url`, `url_128`, `width`, `height`, `name`.
  - Sert MB/format sınırı bu sayfada **yazmıyor**; boyut/oran önerileri Ads Guide'a devredilmiş (bkz. `docs/META-ADS-MANAGER-FIELDS.md` IMAGE_SPECS). Ürün tarafında doğrulama Ads Guide değerleriyle yapılır ve "önerilen" olarak etiketlenir.

## 11. Video yükleme (bu sprintte kapsam dışı — yalnız kayıt)
- **Source:** Ad Account `advideos` edge
- **URL:** https://developers.facebook.com/docs/marketing-api/reference/ad-account/advideos/
- **Used for:** yok (video üretimi yok; kullanıcı videosu gelirse sonraki faz)
- **Doğrulanan:** `POST /act_<ID>/advideos`; `source` / `file_url` / chunked upload (`upload_phase: start|transfer|finish|cancel`); dönen `id`.

## 12. Resmi önizleme
- **Source:** Ad Account `generatepreviews`
- **URL:** https://developers.facebook.com/docs/marketing-api/reference/ad-account/generatepreviews/
- **Used for:** B5 önizleme
- **Doğrulanan:**
  - `GET /act_<ID>/generatepreviews` — zorunlu `creative` (spec) + `ad_format` (enum).
  - Kullanacağımız `ad_format` değerleri enum listesinde teyitli: `DESKTOP_FEED_STANDARD`, `MOBILE_FEED_STANDARD`, `INSTAGRAM_STANDARD`, `INSTAGRAM_STORY`, `INSTAGRAM_REELS`, `FACEBOOK_STORY_MOBILE`, `FACEBOOK_REELS_MOBILE`, `RIGHT_COLUMN_STANDARD`.
  - Cevap: iframe içeren AdPreview node'ları; önizleme **24 saat** geçerli.

## 13. promoted_object + custom_event_type
- **Source:** Marketing API Reference — AdPromotedObject
- **URL:** https://developers.facebook.com/docs/marketing-api/reference/ad-promoted-object/
- **Used for:** `buildAdSetPayload` (OUTCOME_SALES yolu)
- **Doğrulanan:**
  - "If you use pixel_id, you must provide custom_event_type."
  - `custom_event_type` değerleri: `PURCHASE`, `LEAD`, `ADD_TO_CART`, `INITIATED_CHECKOUT`, `COMPLETE_REGISTRATION`, `CONTENT_VIEW`, `SEARCH`, `SUBSCRIBE`, ... (tam liste sayfada).
  - `OFFSITE_CONVERSIONS` optimizasyonunda promoted_object olarak `pixel_id` + `custom_event_type` çifti kullanılır (ODAX eşleme tablosunda da `"pixel_id, custom_event_type"` olarak geçiyor — §14).

## 14. ODAX eşleme tablosu (objective → optimization goal)
- **Source:** Campaign referansındaki ODAX mapping bölümü
- **URL:** https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-campaign-group#odax-mapping
- **Used for:** plan objective'i → geçerli optimization_goal/billing_event seçimi
- **Doğrulanan (tablodan çekilebilenler):**
  - `OUTCOME_TRAFFIC`: `LINK_CLICKS`, `LANDING_PAGE_VIEWS`, `REACH`, `IMPRESSIONS` (web yolu promoted_object gerektirmez).
  - `OFFSITE_CONVERSIONS` hedefli satırlarda promoted_object: `pixel_id, custom_event_type`.
- **Dürüstlük notu:** Tablo çok büyük; `OUTCOME_SALES` satırları fetch özetinde verbatim çekilemedi. OUTCOME_SALES + `OFFSITE_CONVERSIONS` + pixel promoted_object gereksinimi §13 ile çapraz doğrulandı; kesin teyit gerçek test ad account çağrısında yapılacak (REPORT-B "bekleyen testler").
