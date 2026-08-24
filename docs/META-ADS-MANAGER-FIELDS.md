# META ADS MANAGER — ALAN ADLARI, LİSTELER, LİMİTLER (kaynak dokümanı)

`apps/web/src/lib/publish-kit/meta-fields.ts` bu dosyaya referans verir (`META_FIELDS_DOC`).
Dosya daha önce üretilmiş ama hiç commit'lenmemişti; **2026-08-24'te** koddaki kaynak izlerinden
(her sabitin yanındaki resmî URL) yeniden üretildi (CLAUDE.md §37 izlenebilirlik).

- **Alan değerlerinin toplandığı tarih:** 2026-08-23 (`META_FIELDS_RETRIEVED_AT`) — Help Center / Ads Guide sayfaları.
- **API-seviyesi enum/payload teyitleri:** 2026-08-24, `docs/meta/SOURCES-B.md` (Marketing API referansları).
- Türkçe etiketler yalnız Meta'nın `tr_TR` sayfalarından; tr kaynağı yoksa EN bırakıldı (uydurma çeviri yok).

## 1. Kaynak listesi (SRC haritası)

| Kısaltma | İçerik | URL |
|---|---|---|
| objectives | 6 basitleştirilmiş amaç | https://www.facebook.com/business/help/1438417719786914 |
| levels | Kampanya / reklam seti / reklam seviyeleri | https://www.facebook.com/business/help/621956575422138 |
| createCampaign | Kampanya oluşturma | https://www.facebook.com/business/help/1658289035439772 |
| editCampaign | Kampanya/set/reklam düzenleme | https://www.facebook.com/business/help/2169779963333459 |
| createAd | Reklam oluşturma | https://www.facebook.com/business/help/1006187918591258 |
| advantageAudience | Advantage+ hedef kitlesi | https://www.facebook.com/business/help/273363992030035 |
| advantageAudienceSetup | Advantage+ kitle kurulumu | https://www.facebook.com/business/help/793748385630490 |
| acb | Advantage+ kampanya bütçesi | https://www.facebook.com/business/help/153514848493595 |
| specialAdCategory | Özel reklam kategorileri | https://www.facebook.com/business/help/298000447747885 |
| conversionLocations | Amaca göre dönüşüm konumları/olayları | https://www.facebook.com/business/help/2035196646663270 |
| performanceGoals | Amaca göre performans hedefleri | https://www.facebook.com/business/help/416997652473726 |
| choosePlacements | Reklam alanı seçimi | https://www.facebook.com/business/help/175741192481247 |
| placementsList | Tüm yerleşimler listesi | https://www.facebook.com/business/help/407108559393196 |
| ageTargeting | Yaş hedefleme (13–65+) | https://en-gb.facebook.com/business/help/103928676365132 |
| textBestPractices | Metin uzunluğu önerileri | https://www.facebook.com/business/help/223409425500940 |
| minPixels | Önerilen minimum görsel pikselleri | https://www.facebook.com/business/help/469767027114079 |
| aspectRatios | Yerleşime göre en-boy oranları | https://www.facebook.com/business/help/103816146375741 |
| bulkFieldNames | Ads Manager alanı ↔ tablo sütunu eşlemesi | https://www.facebook.com/business/help/1462433740708893 |
| bulkColumns | İçe/dışa aktarma şablonu sütunları | https://www.facebook.com/business/help/1471948569691450 |
| adsGuideFbFeed | Ads Guide — FB feed görsel | https://www.facebook.com/business/ads-guide/image/facebook-feed |
| adsGuideIgStory | Ads Guide — IG story görsel | https://www.facebook.com/business/ads-guide/update/image/instagram-story |
| apiCampaign | API Campaign referansı | https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/ |
| apiAdset | API Ad Set referansı | https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/ |
| apiPromotedObject | API AdPromotedObject | https://developers.facebook.com/docs/marketing-api/reference/ad-promoted-object/ |
| apiCta | API CTA referansı | https://developers.facebook.com/docs/marketing-api/reference/ad-creative-link-data-call-to-action/ |

## 2. Amaçlar (OBJECTIVES)

6 basitleştirilmiş amaç (UI etiketleri Help Center 1438417719786914, tr_TR + en_US; API enum'u
ad-campaign-group referansı, **2026-08-24'te yeniden teyit edildi** — SOURCES-B §1):

| UI (TR) | UI (EN) | API enum |
|---|---|---|
| Bilinirlik | Awareness | `OUTCOME_AWARENESS` |
| Trafik | Traffic | `OUTCOME_TRAFFIC` |
| Etkileşim | Engagement | `OUTCOME_ENGAGEMENT` |
| Potansiyel müşteriler | Leads | `OUTCOME_LEADS` |
| Uygulama tanıtımı | App promotion | `OUTCOME_APP_PROMOTION` |
| Satışlar | Sales | `OUTCOME_SALES` |

## 3. Özel reklam kategorileri (SPECIAL_AD_CATEGORIES)

API enum (ad-campaign-group, 2026-08-24 teyitli): `NONE`, `CREDIT`, `FINANCIAL_PRODUCTS_SERVICES`,
`EMPLOYMENT`, `HOUSING`, `ISSUES_ELECTIONS_POLITICS`, `ONLINE_GAMBLING_AND_GAMING`.
UI etiketleri Help Center 298000447747885. **API'de alan zorunludur; kategori yoksa boş dizi gönderilir.**
Panelde varsayılan seçilmez — kullanıcı cevaplar (yanlış beyan Meta reddi demektir).

## 4. Yerleşim modları (PLACEMENT_MODES)

Help Center 175741192481247 (tr_TR): "Advantage+ reklam alanları" varsayılan; "Manuel reklam alanları" seçilebilir.

## 5. Dönüşüm konumu / performans hedefi (Satışlar amacı)

Help Center 2035196646663270 + 416997652473726 (tr_TR):
- Konumlar: İnternet sitesi, Uygulama, İnternet sitesi ve uygulama, İnternet sitesi ve mağaza içi, İnternet sitesi ve aramalar, Messenger, WhatsApp.
- İnternet sitesi için performans hedefleri: dönüşüm sayısı, dönüşüm değeri, yönlendirme sayfası görüntülemeleri, bağlantı tıklamaları, günlük tekil erişim, gösterim sayısı maksimizasyonu.

## 6. Yaş ve cinsiyet

- Yaş sınırları (103928676365132): minimum 13, üst etiket "65+".
- Cinsiyet: Tüm cinsiyetler / Erkekler / Kadınlar (API karşılığı `genders: [1]`=erkek, `[2]`=kadın — SOURCES-B §7).

## 7. CTA butonları

API enum listesi ad-creative-link-data-call-to-action referansından; UI etiketi yalnız resmî eşleme
sayfasında (1462433740708893) verilen 7 buton için Türkçe (`SHOP_NOW`, `LEARN_MORE`, `SIGN_UP`,
`DOWNLOAD`, `BOOK_TRAVEL`, `SEE_DETAILS`, `WATCH_MORE`); diğerlerinde etiket = enum (uydurulmadı).
Serbest metin → enum eşlemesi bizim `synonyms` listemizdir ve UI'da "yaklaşık, doğrula" diye işaretlenir.
2026-08-24 teyidi: creative referansında CTA enum listesi geniş (75+ değer); kullandığımız enum'lar listede (SOURCES-B §4).

## 8. Kopya uzunlukları (COPY_LIMITS)

Help Center 223409425500940 (tr_TR): çoğu reklam alanı için **önerilen** uzunluklar —
Ana metin 125, Başlık 40, Açıklama 25 karakter. Sert üst sınır resmî sayfalarda yok; UI yalnız "önerilen" gösterir.

## 9. Görsel boyutları (IMAGE_SPECS)

| Oran | Piksel | Yerleşim | Kaynak |
|---|---|---|---|
| 1:1 | 1080×1080 | Akış (kare) | Help Center 469767027114079 |
| 4:5 | 1440×1800 | Akış (dikey) | Help Center 469767027114079 |
| 9:16 | 1440×2560 | Hikâye / Reels | Ads Guide instagram-story |

API `adimages` ucu sert MB sınırı yayınlamıyor (SOURCES-B §10); doğrulama bu önerilen değerlerle yapılır ve öyle etiketlenir.

## 10. Reklam formatları (AD_FORMATS)

Help Center 621956575422138 (tr_TR): "Tek görsel veya video", "Döngü" (carousel), "Koleksiyon".
Bu sprintin API yayın hattı yalnız **tek görsel** formatını kurar (video üretimi kapsam dışı).
