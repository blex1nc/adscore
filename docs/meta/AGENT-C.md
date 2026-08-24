# AJAN C — VERİ VE İSTİHBARAT (insights + Ad Library)

Önce oku: `CLAUDE.md` (§6, §10, §12, §24, §25, §26, §28, §38, §43), `HANDOFF.md` (§14, §21.5), `docs/meta/ANALIZ.md`, `docs/meta/CONTRACTS.md`. Sonra bu dosya.
Branch: `meta/agent-c`. Port 3002. Sahip olduğun dosyalar: CONTRACTS §5. **Deploy/push yok.**

## 1. Amaç

İki okuma yüzeyi:

1. **Insights senkronu** — yayınlanmış kampanyaların gerçek performans verisi Meta'dan gelsin ve **mevcut** AdScore → sinyal → optimizasyon → Learning zincirine aynen aksın.
2. **Ad Library** — EU kapsamındaki pazarlarda rakip reklamları otomatik toplansın, mevcut analiz/pattern motoruna girdi olsun.

Sen **zeka katmanını değiştirmiyorsun**; ona gerçek veri besliyorsun. `lib/results/metrics.ts`, `lib/optimization/*` iç mantığına dokunma.

## 2. t=0 — A'yı beklerken

1. **Doğrulama işi (kod yazmadan)**, `docs/meta/SOURCES-C.md`'ye kaynak + retrieved_at:
   - Insights ucu: seviyeler (campaign/adset/ad), `fields` adları (spend, impressions, clicks, **inline_link_clicks**, reach, frequency, actions, action_values), `date_preset` / `time_range`, `time_increment`, attribution ayarları, para birimi alanı.
   - **Attribution uyarısı:** Meta'nın dönüşüm sayısı attribution penceresine bağlıdır ve **geriye dönük değişir**. Hangi pencere kullanıldığı kayda geçmeli ve UI'da yazmalı (CLAUDE.md §28).
   - `actions` dizisinden satın alma / sepete ekleme / ödeme başlatma **action_type** adlarının tam yazımı.
   - Ad Library (`ads_archive`): parametreler, dönen alanlar, kapsam kısıtı (PHASE0 §1.4'ü teyit et), rate limit.
2. Saf dönüştürücüyü yaz (Prisma'sız, test edilebilir): `Meta insights JSON → CampaignResult girdisi`. A'nın istemcisi gelmeden node testiyle koşar.

## 3. İşler

### C1 — Insights senkronu
- Kullanıcı bir kampanya planında "Meta'dan sonuçları çek" der (otomatik zamanlanmış senkron **bu sprintte yok** — Vercel'de cron kararı ayrı).
- `MetaInsightSync` kaydı açılır; dönem seçilir (varsayılan: yayın tarihinden bugüne).
- Meta cevabı ham `raw`'a yazılır (açıklanabilirlik), sayılar **koddan** türetilir.
- **Yazma yolu:** veri `addCampaignResult`'ın kullandığı **aynı zod şeması ve aynı doğrulamalardan** geçerek `CampaignResult`'a yazılır (`source = META_API`, `externalRef = meta campaign id`). Yeni sonuç modeli açma; doğrulamayı bypass etme.
- **Idempotent:** aynı dönem tekrar çekilirse yeni satır oluşmaz, mevcut satır güncellenir (`@@unique([planId, periodStart, periodEnd, source])`).
- **Dürüstlük kuralları:**
  - Erişim (reach) günlük satırlardan **toplanmaz** (kişiler örtüşür) — CSV parser'daki kararla birebir aynı davran.
  - Dönüşüm verisi yoksa "conversion tracking yok" açıkça yazılır (CLAUDE.md §24).
  - Mevcut Insufficient Data kapıları (≥1000 gösterim, ≥20 tıklama) aynen geçerli — API'den geldi diye kapı gevşetilmez.
  - Attribution penceresi + çekilme tarihi sonuç kartında görünür (§38 tazelik).
- Manuel giriş ve CSV yolları **kalır**; kaynak rozeti (Elle / CSV / Meta API) sonuç listesinde gösterilir.

### C2 — Ad Library rakip toplama
- Rakip kartında "Ad Library'de ara" → `ads_archive` sorgusu (marka adı / sayfa).
- Dönen kayıtlar `CompetitorAd` olarak **referans + metin girdisi** biçiminde saklanır (`fromAdLibrary = true`, `adArchiveId`, `libraryMeta`); görsel/telif içerik kopyalanmaz (CLAUDE.md §10, §13, HANDOFF §21.5).
- Sonra mevcut analiz akışı (AI yapılandırılmış analiz → pattern ≥3 kuralı) **aynen** kullanılır — yeni motor yazma.
- **Kapsam dürüstlüğü (zorunlu UI metni):** *"Ad Library yalnız kapsamdaki reklamları döndürür; sonuçlar rakibin tüm reklamları değildir."* TR-only reklamlar dönmez (PHASE0 §1.4) → kapsam dışı pazarda kullanıcı manuel yola yönlendirilir, boş sonuç "rakip reklam vermiyor" gibi sunulmaz.
- Sorgu + tarih + dönen kayıt sayısı `ResearchSource` mantığıyla kaydedilir (§37).

### C3 — Meta kullanım ve maliyet paneli
- `MetaApiCall` üzerinden: son 24 saat çağrı sayısı, hata oranı, rate limit doluluk yüzdesi (`X-App-Usage`).
- **Neden önemli:** Full Access şartı "son 15 günde ≥500 başarılı çağrı + hata oranı <%15" (PHASE0 §1.1). Bu panel App Review hazırlığının ölçüm aracı.
- Ayarlar altında sade bir bölüm; uydurma maliyet tahmini yok, yalnız sayılan gerçekler.

## 4. Kırmızı çizgiler (senin için ekstra)

- Zeka katmanının eşiklerini, ağırlıklarını, prompt'larını **değiştirme.** Sadece besle.
- Meta'dan gelen sayı ile elle girilen sayıyı **karıştırma**; kaynak her zaman görünür.
- Eksik metrik varsa **hesaplama uydurma** (ör. purchase yoksa ROAS üretme).
- Rakip reklam metnini birebir kopyalayıp creative üretimine sokma (§13) — analiz/patern girdisi olarak kalır.
- Otomatik/zamanlanmış senkron yazma (kullanıcı tetikler).

## 5. Test kanıtı (zorunlu)

1. Gerçek test hesabından insights çekildi; sayılar Ads Manager ekranıyla kıyaslandı (eşleşme veya farkın nedeni raporda).
2. Aynı dönem iki kez çekildi → **tek** satır kaldı (idempotent).
3. Yetersiz veri dönemi → mevcut Insufficient Data mesajı çıktı (kapı gevşemedi).
4. Dönüştürücü birim testli (actions dizisi → purchase/revenue; eksik alan senaryoları).
5. Ad Library sorgusu gerçek çağrıyla denendi; kapsam dışı örnekte dürüst boş-sonuç metni göründü.
6. Bağlantı yokken her iki ekran da BLOCKED gösterdi.

## 6. Rapor

`docs/meta/REPORT-C.md`: yapılanlar, doğrulanan uçlar (SOURCES-C), test kanıtları (özellikle Ads Manager kıyası), A ve B'ye notlar, açık kalanlar.
