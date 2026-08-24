# SOURCES-C — Ajan C'nin doğruladığı uçlar (CLAUDE.md §37, CONTRACTS §1)

Tarih: 2026-08-24. Tüm kayıtlar bu tarihte alındı (retrieved_at: 2026-08-24).

**Araç notu:** Kullanıcının bağladığı "Meta Developer Tools" MCP sunucusu bu ajan
oturumunda araç listesinde GÖRÜNMEDİ (ToolSearch "meta" sorgusu boş döndü; deferred
listede yalnız n8n + harness araçları var). Doğrulama bu yüzden WebFetch/WebSearch ile
developers.facebook.com üzerinden yapıldı. Meta'nın yeni `documentation/ads-commerce/...`
sayfaları JS-render olduğundan okunamadı (404/boş); içerik hâlâ sunucu tarafında render
edilen `docs/graph-api/reference/...` sayfalarından alındı.

---

## 1. Insights ucu (C1 — senkron)

```text
Source: Meta Graph API Reference — Ad Account Insights edge
URL: https://developers.facebook.com/docs/graph-api/reference/ad-account/insights/
Retrieved: 2026-08-24
Type: official docs
Reliability: High (resmi referans)
Used for: C1 insights senkronu — parametre ve alan adları
```

**Uç:** `GET /{campaign-id}/insights` (kampanya nesnesi üstünden; edge account/campaign/adset/ad
seviyelerinin hepsinde var). Sürüm sabiti Ajan A'nın istemcisinde (`META_API_VERSION`).

**Parametreler (birebir doğrulandı):**
- `level`: `ad` | `adset` | `campaign` | `account`
- `date_preset` (varsayılan `last_30d`): `today, yesterday, this_month, last_month, this_quarter,
  maximum, data_maximum, last_3d, last_7d, last_14d, last_28d, last_30d, last_90d,
  last_week_mon_sun, last_week_sun_sat, last_quarter, last_year, this_week_mon_today,
  this_week_sun_today, this_year`
- `time_range`: `{'since': 'YYYY-MM-DD', 'until': 'YYYY-MM-DD'}` (gün başlangıcı gece yarısı)
- `time_increment`: 1–90 tamsayı | `monthly` | `all_days` (varsayılan `all_days`)
  → **Biz `all_days` (tek toplam satır) kullanıyoruz** ki `reach` dönemin gerçek tekil erişimi
  olsun; günlük satırlardan reach toplanamaz (CSV parser kararıyla aynı).
- `action_attribution_windows` (varsayılan `default`): `1d_view, 7d_view, 28d_view, 1d_click,
  7d_click, 28d_click, 1d_ev, dda, default, ...first_conversion/all_conversions varyantları, skan_*`
- `use_unified_attribution_setting` (boolean), `action_report_time` (`impression|conversion|mixed|lifetime`)
  → aşağıdaki 10 Haziran 2025 değişikliği nedeniyle GÖNDERİLMİYOR (yok sayılıyor).
- `filtering`, `default_summary`, `fields` (fields verilmezse yalnız impressions+spend döner).

**Alanlar (birebir doğrulandı, hepsi mevcut):** `spend` ("estimated"), `impressions`, `clicks`,
`inline_link_clicks`, `reach` ("estimated"), `frequency` ("estimated"), `actions`,
`action_values`, `account_currency`, `date_start`, `date_stop`, `purchase_roas`, `ctr`, `cpc`,
`cpm`, `campaign_id`, `campaign_name`, `attribution_setting` ("The default attribution window
to be used when attribution result is calculated").
→ Türetilmiş metrikleri (ctr/cpc/cpm/roas) Meta'dan İSTEMİYORUZ; mevcut karar gereği
`lib/results/metrics.ts` koddan hesaplar. Meta'dan yalnız ham sayılar + `attribution_setting` alınır.

**Sayı biçimi:** Insights cevabında sayısal alanlar STRING gelir ("123", "45.67") — dönüştürücü
katı parse eder, NaN reddedilir.

## 2. Attribution — kayda geçen gerçekler (C1 dürüstlük notu)

```text
Source: Meta for Developers — Insights API değişiklik duyurusu (10 Haziran 2025)
URL: https://developers.facebook.com/docs/marketing-api/insights/ (duyuru metni arama
     snippet'inde; sayfanın JS-render kısmında). İkincil teyit: ppc.land, windsor.ai,
     Supermetrics community duyuru özetleri (2025).
Retrieved: 2026-08-24
Type: official announcement (ikincil kaynak teyitli)
Reliability: High (birden çok bağımsız teyit; resmi sayfa JS nedeniyle tam okunamadı)
Used for: attribution penceresi kaydı + UI metni
```

- **10 Haziran 2025'ten beri:** `use_unified_attribution_setting` ve `action_report_time`
  parametreleri YOK SAYILIR; API cevabı Ads Manager ayarlarını taklit eder — attribute edilen
  değerler **ad set seviyesindeki attribution ayarına** göre döner. Inline/on-ad aksiyonlar
  `1d_click`/`1d_view` verisine dahil edilir.
- `action_report_time=mixed` davranışı geçerli: Meta-üstü aksiyonlar gösterim tarihine,
  Meta-dışı aksiyonlar (ör. web satın alma) dönüşüm tarihine yazılır.
- **Geriye dönük değişim:** dönüşüm metrikleri attribution penceresi dolana kadar (ör. 7d_click)
  ve gecikmeli event'lerle sonradan DEĞİŞEBİLİR; `spend`/`reach`/`frequency` resmi dokümanda
  "estimated" işaretli. → Bu yüzden her senkronda **çekilme tarihi + attribution_setting**
  kaydedilir ve sonuç kartında gösterilir (CLAUDE.md §28/§38).
- Uygulama kararı: attribution parametresi GÖNDERMİYORUZ (varsayılan = Ads Manager ile aynı);
  cevaptaki `attribution_setting` alanı olduğu gibi kaydedilir.

## 3. `actions` / `action_values` — action_type tam yazımları (C1)

```text
Source: Meta Graph API Reference — Ads Action Stats
URL: https://developers.facebook.com/docs/marketing-api/reference/ads-action-stats/
Retrieved: 2026-08-24
Type: official docs (v26.0 referansı)
Reliability: High
Used for: purchase/add-to-cart/checkout sayımı — çift sayım önleme
```

- **Satın alma:** `omni_purchase` ("Purchases" — kanallar arası toplam),
  `offsite_conversion.fb_pixel_purchase` (web/pixel), `onsite_conversion.purchase`
  (On-Facebook), `app_custom_event.fb_mobile_purchase` (mobil app).
- **Sepete ekleme:** `omni_add_to_cart` (toplam), `offsite_conversion.fb_pixel_add_to_cart`,
  `app_custom_event.fb_mobile_add_to_cart`.
- **Ödeme başlatma:** `omni_initiated_checkout` (toplam),
  `offsite_conversion.fb_pixel_initiate_checkout`, `app_custom_event.fb_mobile_initiated_checkout`.
- Diğer: `link_click`, `landing_page_view`, `lead` (toplam), `offsite_conversion.fb_pixel_lead`.
- **ÇİFT SAYIM KURALI:** `omni_*` toplamları kanal-özel tiplerin ÜST KÜMESİDİR. Dönüştürücü
  TEK kanonik tip seçer (öncelik: `omni_purchase` → yoksa `offsite_conversion.fb_pixel_purchase`
  → yoksa `onsite_conversion.purchase`), tipler arası TOPLAMA YAPMAZ ve hangi tipi kullandığını
  kayda yazar. Revenue aynı action_type'ın `action_values` karşılığından alınır.
- Attribution alt anahtarları (`1d_click`, `7d_click`, `value`...) mevcut; biz `value`
  (varsayılan pencere toplamı) kullanırız.

## 4. Ad Library — `ads_archive` (C2)

```text
Source: Meta Graph API Reference — ads_archive
URL: https://developers.facebook.com/docs/graph-api/reference/ads_archive/
Retrieved: 2026-08-24
Type: official docs
Reliability: High
Used for: C2 rakip reklam sorgusu — parametreler + kapsam kısıtı
```

**Parametreler (birebir doğrulandı):**
- `ad_reached_countries` (**ZORUNLU**; ISO ülke kodu dizisi veya "ALL")
- `search_terms` (string, max 100 karakter; çeviri YAPILMAZ — reklam dilinde aranmalı)
- `search_page_ids` (en fazla 10 Page ID)
- `search_type`: `KEYWORD_UNORDERED` (varsayılan) | `KEYWORD_EXACT_PHRASE`
- `ad_type`: `ALL` (varsayılan) | `EMPLOYMENT_ADS` | `FINANCIAL_PRODUCTS_AND_SERVICES_ADS` |
  `HOUSING_ADS` | `POLITICAL_AND_ISSUE_ADS`
- `ad_active_status`: `ACTIVE` (varsayılan) | `INACTIVE` | `ALL`
- `ad_delivery_date_min/max` (YYYY-MM-DD), `media_type` (`ALL|IMAGE|MEME|VIDEO|NONE`),
  `publisher_platforms` (`FACEBOOK, INSTAGRAM, AUDIENCE_NETWORK, MESSENGER, WHATSAPP, OCULUS, THREADS`),
  `languages` (ISO 639-1), `unmask_removed_content` (bool). Politik reklamlara özel:
  `bylines`, `delivery_by_region`, `estimated_audience_size_min/max`.

**Kapsam kısıtı (resmi cümle, PHASE0 §1.4 TEYİT):**
> "Ads that did not reach any location in the EU will only return if they are about social
> issues, elections or politics."
→ TR-only ticari reklam DÖNMEZ; EU'ya da ulaşan ticari reklamlar döner. Boş sonuç
"rakip reklam vermiyor" DEMEK DEĞİLDİR — zorunlu UI metni AGENT-C §Mutlak Kurallar'da.

**Dönen alanlar (ArchivedAd):**

```text
Source: Meta Graph API Reference — ArchivedAd node
URL: https://developers.facebook.com/docs/graph-api/reference/archived-ad/
Retrieved: 2026-08-24
Type: official docs
Reliability: High
Used for: CompetitorAd.libraryMeta alan seçimi
```

Genel: `id` (Library ID), `ad_creation_time`, `ad_creative_bodies`, `ad_creative_link_captions`,
`ad_creative_link_descriptions`, `ad_creative_link_titles`, `ad_delivery_start_time`,
`ad_delivery_stop_time`, `ad_snapshot_url`, `languages`, `page_id`, `page_name`,
`publisher_platforms`. EU/UK'ye özel: `eu_total_reach`, `age_country_gender_reach_breakdown`,
`beneficiary_payers`, `target_ages/target_gender/target_locations`. YALNIZ politik reklamlarda:
`spend`, `impressions`, `currency`, `demographic_distribution`, `estimated_audience_size`.
→ **Ticari reklamda spend/impressions BEKLENMEZ** — UI bu alanları vaat etmez.
Uç READ-ONLY. Metin alanları referans+analiz girdisi olarak saklanır; görsel kopyalanmaz
(`ad_snapshot_url` yalnız link olarak tutulur — CLAUDE.md §13).

**Üçüncü taraf uyumsuzluk notu (dürüstlük):** Bazı 2026 tarihli üçüncü taraf rehberler
(adlibrary.com, admanage.ai, hyperfx.ai — vendor blog, Reliability: Low) ticari reklamların
`ads_archive`'dan API ile HİÇ dönmediğini, kapsamın politik/özel kategorilerle sınırlı olduğunu
iddia ediyor. Resmi referans sayfası bunun tersini söylüyor (yukarıdaki EU cümlesi `ad_type=ALL`
varsayılanıyla birlikte). **Karar: resmi doküman esas alındı; gerçek davranış OAuth bağlantısı
gelince tek gerçek çağrıyla test edilecek** (REPORT-C "BEKLİYOR" bölümü). Ticari sonuç
dönmezse UI zaten dürüst boş-kapsam metnini gösteriyor.

**Rate limit:** Ad Library API için resmî rate limit sayfasında ayrı satır YOK; üçüncü taraf
kaynaklar saatte ~200 çağrı/kullanıcı token'ı diyor (Reliability: Low — kayda geçirildi,
üründe varsayım olarak KULLANILMIYOR; istemci X-App-Usage'a bakar).

## 5. Rate limit başlıkları (C3 — kullanım paneli)

```text
Source: Meta Marketing API — Rate Limiting
URL: https://developers.facebook.com/docs/marketing-api/overview/rate-limiting/
Retrieved: 2026-08-24
Type: official docs
Reliability: High
Used for: C3 MetaApiCall paneli — doluluk yüzdesi yorumu
```

- Başlıklar: `X-Ad-Account-Usage` (`acc_id_util_pct`, `reset_time_duration`,
  `ads_api_access_tier`), `X-Business-Use-Case-Usage` (`call_count`, `total_cputime`,
  `total_time`, `estimated_time_to_regain_access`), `X-FB-Ads-Insights-Throttle`
  (`app_id_util_pct`, `acc_id_util_pct`, `ads_api_access_tier`).
- Insights BUC kotası: development tier taban 600/saat/ad account; standard 190.000
  (+400×aktif reklam − 0.001×kullanıcı hatası).
- Throttle hata kodları: 17 (alt 2446079), 613 (alt 1487742 vd.), 4, 80000/80003/80004/80014.
- Öneri: eşit dağıtım, batch, exponential backoff, Insights için async job.
- `MetaApiCall.appUsagePct` bu başlıklardan Ajan A'nın istemcisince doldurulur; C3 paneli
  yalnız kayıtları OKUR (sayı uydurma yok; başlık gelmemişse "-" gösterilir).

## 6. Full Access şartı bağlamı (C3 panelinin gerekçesi)

PHASE0 §1.1 (Retrieved 2026-08-12) geçerli: Full Access için son 15 günde ≥500 başarılı
çağrı + hata oranı <%15 + App Review. C3 paneli bu iki sayıyı `MetaApiCall` kayıtlarından
ölçer — App Review hazırlık göstergesi.
