# RAPOR C — Veri & İstihbarat (insights senkronu + Ad Library + kullanım paneli)

Tarih: 2026-08-24. Branch: `meta/agent-c`. Ajan A'nın branch'i tamamen merge edildi
(migration DB'ye A tarafından uygulandı; burada yalnız `pnpm db:generate` + dev server restart).

## 1. Yapılanlar

### C1 — Insights senkronu
- `lib/meta-insights/transform.ts`: **saf** dönüştürücü (Prisma'sız/fetch'siz), Meta insights
  JSON → CampaignResult taslağı. Davranışlar CSV parser'la birebir: reach günlük satırlardan
  **toplanmaz**, tek kampanya kuralı, eksik metrikten hesap uydurulmaz. Satın alma sayımı
  **tek** action_type'tan (öncelik `omni_purchase` → pixel → onsite; tipler arası toplama YOK —
  çift sayım engellendi, kullanılan tip kayda geçer). Meta'nın string sayıları katı parse edilir.
- `lib/meta-insights/sync.ts`: `runInsightSync` — A'nın istemcisiyle (`requireBrandBinding`)
  kampanya seviyesinde `GET /{metaCampaignId}/insights` (time_increment YOK → all_days tek satır,
  reach dönemin gerçek tekil erişimi). Ham cevap `MetaInsightSync.raw`'a; sayılar koddan.
  Veri **aynı `resultSchema`** doğrulamasından geçip `CampaignResult`'a yazılır
  (`source=META_API`, `externalRef=metaCampaignId`). **İdempotent:** `@@unique([planId,
  periodStart, periodEnd, source])` üzerinden bul-güncelle; aynı dönem ikinci çekimde satır
  güncellenir, yeni satır açılmaz. Güncellemede eski AI analizi bayatladığı için
  `analysisStatus` sıfırlanır (kullanıcı isterse yeniden koşar; kapılar aynen).
- `actions/meta-insights.ts`: `syncMetaResults` — kullanıcı tetikler (otomatik/zamanlanmış
  senkron YOK). Varsayılan dönem: `metaPublishedAt` → bugün.
- UI: `components/insights/meta-sync-section.tsx` (+form) — attribution'ın geriye dönük
  değişebildiği açıkça yazar; senkron geçmişi listelenir; plan Meta'da yayınlanmamışsa dürüst
  bilgi. `components/insights/source-badge.tsx` — **Elle / CSV / Meta API** rozeti; META_API
  satırında attribution + çekilme tarihi notu görünür (§38). Not `CampaignResult.notes`'a yazılır:
  `Meta API senkronu · çekildi: ... · attribution: ... · satın alma sayımı: ... · tıklama: ...`.
- Şema tekilleştirme: `resultSchema` `lib/results/schema.ts`'e çıkarıldı;
  `actions/results.ts` aynı şemayı import ediyor (elle/CSV/Meta → TEK doğrulama yolu).

### C2 — Ad Library rakip toplama
- `lib/meta-library/archive.ts` (saf) + `lib/meta-library/search.ts` + `actions/meta-library.ts`
  + `components/library/ad-library-search.tsx` / `ad-library-badge.tsx`.
- `ads_archive` sorgusu A'nın istemcisinden (`metaClientForWorkspace`); `ad_type=ALL`,
  `ad_active_status=ALL`, `search_terms` ≤100 karakter, `ad_reached_countries` kullanıcı seçimi
  (TR + EU-27 listesi; TR seçiminde ek kapsam uyarısı).
- Kayıt: `CompetitorAd` **referans + metin girdisi** (`fromAdLibrary=true`, `adArchiveId`,
  `libraryMeta` = sorgu + retrievedAt + dönen kayıt sayısı + kapsam notu — §37 kaynak takibi).
  Görsel/telif içerik kopyalanmaz. **`ad_snapshot_url` İSTENMİYOR ve SAKLANMIYOR** (access_token
  içeriyor); referans linki token'sız halka açık `facebook.com/ads/library/?id=...`.
- Kaydedilen her reklam için **mevcut** analiz akışı (`executeAdAnalysis`) tetiklenir — yeni motor
  yok; pattern ≥3 kuralı aynen. Maliyet kontrolü (§43): arama başına en çok **6 yeni** kayıt
  (tekilleştirme sayesinde tekrar arama kalanları getirir); metinsiz kayıt analiz motoruna
  sokulmaz, açıkça "atlandı" raporlanır.
- **Kapsam dürüstlüğü:** zorunlu metin *"Ad Library yalnız kapsamdaki reklamları döndürür;
  sonuçlar rakibin tüm reklamları değildir."* her zaman görünür. Boş sonuç metni rakibin reklam
  vermediğini İMA ETMEZ; TR-only pazarda manuel yola yönlendirir.

### C3 — Meta API kullanım paneli
- `app/app/settings/meta-usage/page.tsx`: `MetaApiCall` kayıtlarından son 24 saat çağrı/hata,
  son çağrının `appUsagePct`'i (X-App-Usage/X-Ad-Account-Usage — A'nın istemcisi dolduruyor),
  son 15 gün başarılı çağrı + hata oranı ve **Full Access eşiği** (≥500 / <%15, PHASE0 §1.1)
  ölçümü, son 20 çağrı tablosu. Kayıt yoksa dürüst boş durum; hiçbir sayı uydurulmuyor.

### Ortak dosyalara dokunuşlar (satır düzeyinde — CONTRACTS §5)
- `app/app/brands/[id]/campaigns/page.tsx`: 2 import + `<MetaSyncSection/>` + `<ResultSourceBadge/>` satırları.
- `app/app/brands/[id]/competitors/page.tsx`: 2 import + `<AdLibrarySearch/>` + `<AdLibraryBadge/>` satırları;
  ayrıca **önceden var olan** lint hatası düzeltildi (`pattern'ler` → `&apos;`; eski dosyada da eslint kırmızıydı).
- `app/app/settings/page.tsx`: "API kullanımı →" tek link.
- `apps/web/package.json` `test` script'ine C test dosyaları eklendi (A'nın genişlettiği satırın devamı).
- `actions/results.ts`: (1) `resultSchema` import'a çevrildi (şema `lib/results/schema.ts`'e taşındı,
  içerik birebir aynı); (2) **A'nın raporundaki uyarı üzerine** `addCampaignResult`'a P2002 yakalama
  eklendi — yeni unique kısıt yüzünden aynı dönem ikinci elle giriş artık ham Prisma hatası yerine
  eyleme dönük TR mesajla reddediliyor (canlıda doğrulandı, aşağıda).

## 2. Doğrulanan uçlar

`docs/meta/SOURCES-C.md` (hepsi retrieved 2026-08-24, resmi docs):
- Insights edge: `level`, `date_preset` (tam liste), `time_range`, `time_increment`,
  attribution parametreleri; alanlar (`inline_link_clicks`, `actions`, `action_values`,
  `attribution_setting`, `account_currency`...). `reach`/`frequency`/`spend` resmi olarak "estimated".
- **10 Haziran 2025 değişikliği:** `use_unified_attribution_setting` / `action_report_time` yok
  sayılır; cevap ad-set attribution ayarına göre Ads Manager'ı taklit eder → parametre
  göndermiyoruz, cevaptaki `attribution_setting` kaydedilip UI'da gösteriliyor.
- `actions` action_type tam yazımları: `omni_purchase` / `offsite_conversion.fb_pixel_purchase` /
  `onsite_conversion.purchase` (+ add_to_cart / initiated_checkout aileleri) — omni = üst küme,
  toplanmaz.
- `ads_archive` parametreleri + **resmi kapsam cümlesi** (PHASE0 §1.4 teyit): EU'ya ulaşmayan
  reklamlar yalnız politik/sosyal ise döner. `ArchivedAd` alan listesi: ticari reklamda
  spend/impressions YOK (yalnız politik) — UI bunları vaat etmiyor.
- Rate limit başlıkları + Insights BUC kotaları (dev tier 600/saat/hesap) + throttle kodları.
- **Uyumsuzluk notu:** bazı üçüncü taraf 2026 rehberleri ticari reklamların API'den hiç dönmediğini
  iddia ediyor; resmi referans tersini söylüyor. Gerçek çağrı testi bunu kesinleştirecek (Bölüm 4).

## 3. Test kanıtları (2026-08-24)

1. **Birim testler:** `pnpm test` → **94/94** yeşil (dönüştürücü 12: omni önceliği/çift sayım yok,
   inline_link_clicks tercihi, reach toplanmaz, conversion-yok yolu, sıfır harcama reddi, bozuk
   sayı reddi, çok satır toplama; archive 5: metin kompozisyonu, token'sız link, libraryMeta, EU kapsamı).
   `tsc --noEmit` temiz; eslint temiz; `pnpm build` temiz (exit 0).
2. **BLOCKED (server, gerçek kod + gerçek dev DB, mock yok):** harness ile bağlantısız workspace'te
   `runInsightSync` → `blocked: "Bu marka için Meta varlıkları seçilmemiş (eksik: ad account,
   Facebook Page)..."`; `runAdLibrarySearch` → `blocked: "Bu workspace'e bağlı bir Meta hesabı yok..."`.
   Blocked durumda `MetaInsightSync` kaydı açılmıyor (çöp kayıt yok).
3. **İdempotency (DB kısıtı):** aynı `(planId, periodStart, periodEnd, META_API)` ile ikinci INSERT
   → `CampaignResult_planId_periodStart_periodEnd_source_key` unique ihlali (psql, transaction
   rollback ile temiz bırakıldı). Kod yolu aynı anahtarla bul-güncelle yapıyor.
4. **UI (headless Chrome + CDP, port 3002, gerçek login):**
   - Kampanya sayfası: "Meta'dan sonuç senkronu" bölümü + varsayılan dönem (yayın tarihi→bugün) +
     attribution uyarısı görünür; mevcut sonuç satırında **ELLE** rozeti.
   - "Meta'dan sonuçları çek" → UI'da **BLOCKED** kutusu + A'nın TR mesajı.
   - Rakipler sayfası: zorunlu kapsam metni + TR uyarısı görünür; "Ad Library'de ara" → **BLOCKED**.
   - `/app/settings/meta-usage`: dürüst boş durum ("kayıtlı Meta API çağrısı yok").
   - Ekran görüntüleri oturum scratchpad'inde (`ui-sync-section.png`, `ui-sync-blocked.png`,
     `ui-library-blocked.png`, `ui-usage.png`).
5. **Elle/CSV regresyonu (A'nın uyarısı) — İKİSİ DE CANLI DOĞRULANDI:** elle giriş yeni dönemle
   çalışıyor; aynı dönem ikinci giriş dürüst mesajla reddediliyor ve listede tek satır kalıyor.
   CSV yolu da canlı test edildi: upload → önizleme → kayıt BAŞARILI (16-22.08 dönemi, satır
   listeye düştü); aynı CSV ikinci kez → "Bu plan için aynı döneme ait (elle/CSV) bir sonuç zaten
   kayıtlı..." mesajı, satır sayısı 1 kaldı. Ayrıca yeniden senkronda bayat `analysis` blob'u da
   temizleniyor (`Prisma.DbNull`).
6. Test fixture'ları: `meta-test@ornek.dev` kullanıcısı + "Örnek Kahve (Meta UI testi)" markası
   (dev DB). Fixture planındaki `metaCampaignId` yalnız UI yolunu açmak için konulmuş test
   verisidir (ürün yolunda mock Meta cevabı YOK).

## 4. BEKLİYOR — gerçek Meta çağrısı testleri (OAuth bağlantısı şart)

Kullanıcı `/app/settings/meta`'dan bağlanıp marka bağlamı seçince, sırayla:

1. **Insights gerçek testi:** B'nin yayınladığı (PAUSED) kampanya için "Meta'dan sonuçları çek".
   - Beklenen: sonuç satırı **Meta API** rozetiyle düşer; sayılar Ads Manager ekranıyla kıyaslanır
     (fark varsa nedeni: attribution penceresi / rapor saati — nota bakılır) → rapora ekran kıyası.
   - PAUSED kampanya hiç harcamadıysa beklenen dürüst sonuç: "Meta bu dönem için 0 harcama döndürdü..."
     (kayıt açılmaz) veya "veri döndürmedi" — ikisi de doğru davranıştır, rapora geçirilecek.
2. **İdempotent gerçek test:** aynı dönem ikinci kez çekilir → satır sayısı değişmez, not güncellenir.
3. **Insufficient Data:** <1000 gösterimli dönem çekilir → sonuç kartında analiz "Insufficient Data"
   mesajıyla reddedilir (kapı gevşetilmedi — kod yolu `startResultAnalysis`'te aynen duruyor).
4. **Ad Library gerçek testi:** EU pazarında bilinen bir marka adıyla arama (ör. DE) → kayıtların
   `fromAdLibrary` rozetiyle düşmesi; TR-only bir rakip adıyla arama → dürüst boş-kapsam metni.
   Bu test Bölüm 2'deki üçüncü taraf uyumsuzluğunu da kesinleştirir.
5. `/app/settings/meta-usage`'ta gerçek çağrı sayaçlarının ve `appUsagePct`'in dolduğunun görülmesi.

## 5. A ve B'ye notlar

- **A'ya:** `requireBrandBinding` bağlantı hiç yokken de "varlık seçilmemiş" mesajı veriyor
  (binding kontrolü bağlantı kontrolünden önce). Yanlış değil ama "önce bağlan" demek daha doğru
  yönlendirme olurdu — istersen sıralamayı çevir, ben davranışa dokunmadım.
- **B'ye:** Senkron varsayılan dönemi `plan.metaPublishedAt`'ten alıyor — publish COMPLETED
  olduğunda bu alanı doldurmayı unutma. `metaCampaignId` boş kaldıkça kampanya sayfasındaki senkron
  bölümü "yayınlanmamış" der.
- **B'ye:** `campaigns/page.tsx`'e satır düzeyinde eklemeler yaptım (import'lar + 2 bileşen satırı +
  sonuç satırında rozet). Publish girişini eklerken çakışırsa benim satırlarım tek satırlık, kolay rebase edilir.
- **İkisine:** `resultSchema` artık `lib/results/schema.ts`'te — sonuç doğrulaması gereken herkes
  oradan import etsin, kopya şema açmasın.

## 6. Açık kalanlar

- Gerçek OAuth bağlantısı yok → Bölüm 4'teki testler bekliyor (kullanıcı aksiyonu).
- Ad Library sayfalaması: ilk sayfa (limit 25) + arama-başına-6 kayıt sınırı bilinçli; ihtiyaç
  olursa `client.paginate` ile küçük `maxPages` kullanılabilir (A'nın notu: rate limit).
- Aynı dönemli MANUAL satır artık DB kısıtıyla tekil; "mevcut satırı güncelle/sil" UX'i yok
  (silme akışı da yok) — ürün kararı gerekirse ayrı iş.
- Attribution penceresi kampanya bazında `attribution_setting` alanından geliyor; Ads Manager'da
  pencere değiştirilirse eski senkron notları eski pencereyi gösterir (tazelik damgası bunun için).
