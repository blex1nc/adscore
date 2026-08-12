# PHASE 0 — META DOĞRULAMA & SAĞLAYICI KARARLARI

**Tarih:** 2026-08-12
**Amaç:** HANDOFF §23'ün zorunlu ilk adımı — Meta gereksinimlerinin resmi dokümandan doğrulanması + AI/kur sağlayıcı seçimi (kullanıcı "free en iyisini bul" dedi).
**Durum:** Doğrulama tamamlandı. Kod yazılmadı.

---

## 1. META — RESMİ DOKÜMANDAN DOĞRULANAN GERÇEKLER

Tüm kayıtlar: Retrieved 2026-08-12, kaynak developers.facebook.com (resmi).

### 1.1 Erişim seviyeleri (Marketing API)

| | Limited Access (default) | Full Access |
|---|---|---|
| Nasıl alınır | Marketing API ürünü eklenince otomatik | App Review |
| Kapsam | Sınırsız ad account, ama account başına ağır rate limit | Production |
| Meta'nın tanımı | "Development only, canlı reklamverenler için değil" | — |
| Koşul | — | Son 15 günde ≥500 başarılı çağrı + hata oranı <%15 + App Review |

**Geliştirme yolu doğrulandı:** App'te rolü olan kullanıcılar (biz) onaysız izinlerle tüm akışı geliştirebilir. App Review yalnızca dış kullanıcılara açılırken zorunlu. Meta review sırasında app'i fiilen test eder — test edemezse başvuru tümden reddedilir.

### 1.2 Business Verification

- Advanced access isteyen app'ler için gerekli (1 Şub 2023'ten beri); başka işletmelerin verisine erişen app'ler için de gerekli.
- Süreç: App Dashboard → Settings > Basic > Verification → app bir Business portfolio'ya bağlanır → Business Manager'da admin doğrulamayı tamamlar.
- **Doğrulanabilir bir şirket gerektirir.** Süre bilgisi resmi sayfada yok — bilinmiyor.
- ⚠️ AÇIK SORU (F1): Kullanıcının doğrulanabilir şirketi var mı, hangi ülkede?

### 1.3 Gereken izinler ve App Review koşulları

| İzin | Ne sağlar | App Review | Bağımlılıklar |
|---|---|---|---|
| `ads_management` | Kampanya oluşturma/yönetme + metrik | Evet — screencast: login + metrik gösterimi | `pages_read_engagement`, `pages_show_list` |
| `ads_read` | Insights API, raporlar | Evet — screencast: impressions/spend/clicks/reach gösterimi | yok |
| `business_management` | Business Manager API, asset yönetimi | Evet | `pages_read_engagement`, `pages_show_list` |
| `pages_show_list` | Kullanıcının Page listesi | **Hayır** | yok |
| `pages_read_engagement` | Page içerik/metadata okuma | Evet (bağımlılık olarak) | `pages_show_list` |
| `pages_manage_ads` | Page adına reklam oluşturma | Evet | `pages_show_list` |
| `instagram_basic` | IG Business profil/medya okuma | Evet | `pages_read_user_content`, `pages_show_list` |
| `catalog_management` | Katalog CRUD | Evet | `business_management` |
| `read_insights` | Page/app insights | Evet | `pages_read_engagement`, `pages_show_list` |

**MVP izin seti önerisi (minimum):** `ads_management`, `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`, `instagram_basic`. Katalog reklamları sonraki faza kalırsa `catalog_management` ertelenebilir.

### 1.4 Ad Library API (ads_archive) — HİBRİT KARARININ RESMİ TEYİDİ

- `ad_type` değerleri: `POLITICAL_AND_ISSUE_ADS`, `FINANCIAL_PRODUCTS_AND_SERVICES_ADS`, `EMPLOYMENT_ADS`, `HOUSING_ADS`, `ALL` (default).
- Ticari reklamlar `ad_type=ALL` ile sorgulanabilir, **ANCAK** resmi kısıt: *"EU'da hiçbir lokasyona ulaşmamış reklamlar yalnızca politik/sosyal içerikliyse döner."*
- **Sonuç (teyit):** TR-only ticari reklamlara programatik erişim yok. EU'ya da ulaşan reklamlar erişilebilir. → Pazar-bazlı hibrit kararı (HANDOFF 21.5) doğru: EU kapsamındaki pazarlar API'den, diğerleri kullanıcı girdisi + AI analizi.
- Read-only uç; OAuth token gerekir.

### 1.5 Delivery Estimate (tahmin ekranı kaynağı — teyit)

- `GET .../{ad-set-id}/delivery_estimate` mevcut; girdi: `targeting_spec` + `optimization_goal` (30+ hedef), opsiyonel `promoted_object`, pixel_id vb.
- `daily_outcomes_curve` alanı **yalnızca yüksek güvenli tahmin üretilebildiğinde** dolu gelir — bu bizim "Insufficient Data" ilkesiyle birebir uyumlu: Meta güven veremiyorsa biz de sayı göstermeyiz.
- Rate limit uygulanır; ad account bağlantısı gerektirir. → Tahmin ekranının Phase 7 konumu ve "bağlı hesap + markanın geçmiş verisi" kaynak kararı teyit edildi.

---

## 2. AI SAĞLAYICI KARARI (GELİŞTİRME FAZI — FREE TIER)

Kullanıcı kararı: "önerdiğim bir şey yok, free en iyisini bul." Aşağıdaki seçim **geliştirme fazı** içindir; production'a çıkmadan önce tekrar değerlendirilecek. Kaynaklar ikincil (karşılaştırma blogları, Retrieved 2026-08-12); kesin limitler key alınırken konsoldan teyit edilecek — free tier limitleri sık değişiyor.

| Rol | Seçim | Neden | Yedek |
|---|---|---|---|
| LLM (ana) | **Google AI Studio — Gemini** | Frontier sınıfı modele en kullanışlı ücretsiz API erişimi; multimodal (reklam görseli analizi için gerekli) | OpenRouter free modelleri |
| LLM (hızlı/toplu) | **Groq — Llama 3.3 70B** | ~30 RPM / 1K istek-gün free, kart istemiyor; ucuz toplu analiz | Cerebras (1M token/gün) |
| Görsel üretim | **Gemini image (Nano Banana) — AI Studio key ile** | Aynı key ile LLM+görsel; bir kaynak ~500 istek/gün free diyor, **kaynaklar çelişkili — key alınınca teyit** | Cloudflare Workers AI (FLUX schnell, günlük ücretsiz kota) |
| Video üretim | **MVP'de YOK** | Ücretsiz ve üretim kalitesinde video API'si yok; copy+statik önce (rapor E3 önerisi) | — |

Mimari koruma: `packages/ai` abstraction (CLAUDE.md §36) — sağlayıcı değişimi tek adapter işi. Free tier rate limit'leri worker'da kuyruk + backoff ile yönetilir.

**Dürüstlük notu:** Free tier'lar geliştirme için yeterli, **canlı SaaS müşterisi için yeterli değil** (rate limit + veri işleme koşulları). Production öncesi ücretli plana geçiş kararı ayrıca alınacak.

## 3. KUR KAYNAĞI ÖNERİSİ

- **Öneri: Frankfurter API** (frankfurter.dev) — ECB referans kurları, key yok, kayıt yok, limit yok, open source. Retrieved 2026-08-12.
- ⚠️ İki dürüstlük notu: (1) ECB kurları **günlük** güncellenir (~16:00 CET) — "anlık" değil, gün içi sabit referans kuru. Bilgilendirme amaçlı panel çevrimi için yeterli; gerçek zamanlı kur şartsa ücretsiz alternatif (ExchangeRate-API, 1.500 çağrı/ay) değerlendirilir. (2) TRY kapsamı Phase 1'de fiilen teyit edilecek.
- Panel çevrimi bilgilendirme amaçlıdır; Meta faturalaması her zaman ad account para birimindedir (HANDOFF 21.5).

---

## 4. KULLANICI AKSİYON LİSTESİ — HESAPLARI SEN AÇACAKSIN

Hesap açma/login işlemlerini Claude yapamaz (güvenlik politikası). Sıra önerisi:

### 4.1 Meta (kritik yol)

1. **Developer hesabı:** developers.facebook.com → mevcut Facebook hesabınla "Get Started" ile developer kaydı.
2. **App oluştur:** developers.facebook.com/apps/creation/ → isim (ör. "AdScore") + iletişim e-postası → use case seçiminde reklam yönetimini kapsayan business use case'i seç (Marketing API ürününü ekletir).
3. **Business portfolio bağla:** App'i Business Manager portfolio'na bağla (yoksa oluştur — doğrulama şart değil, dev fazı için bağlantı yeter).
4. **Test varlıkları:** Kendi Meta Business'ında bir **test ad account + Facebook Page** hazırla (geliştirme bunlarla koşacak).
5. **App ID + App Secret'ı al** (App Dashboard → Settings > Basic). Bunları bana gönderme; §4.3'teki gibi `.env.local`e kendin yapıştıracaksın.

### 4.2 AI + kur

6. **Google AI Studio:** aistudio.google.com → Google hesabıyla gir → "Get API key". (Konsolda görünen güncel free limitlerini not et.)
7. **Groq:** console.groq.com → kayıt → API key. (Opsiyonel ama önerilir.)
8. Frankfurter için hesap gerekmez.

### 4.3 Anahtar teslimi

Proje kurulunca kök dizinde `.env.local` oluşturulacak (git'e girmez, `.gitignore`'da olacak). Değerleri **kendin** yapıştır:

```text
META_APP_ID=
META_APP_SECRET=
GEMINI_API_KEY=
GROQ_API_KEY=
```

Anahtarları sohbete yazma — dosyaya kendin koy, bana sadece "koydum" de.

---

## 5. AÇIK KALANLAR

- **F1:** Business Verification için doğrulanabilir şirket var mı, hangi ülkede? (App Review'a kadar blokör değil; dev fazı şirketsiz ilerler.)
- **G1/G2:** Panel dili ve üretilecek reklam copy dilleri. (Öneri: panel TR+EN, copy dili marka başına seçilebilir — onay bekliyor.)
- P2 soruları (billing, retention, bildirim) ilgili fazlarda.

## 6. SONRAKİ ADIM — PHASE 1 GATE

Phase 1 (platform iskeleti: monorepo, auth, workspace, brand CRUD, design token sistemi, panel+landing iskeleti) hiçbir dış API key'ine ihtiyaç duymaz — sen §4 listesini yaparken paralel başlayabilir. **Kullanıcı onayı bekleniyor.**
