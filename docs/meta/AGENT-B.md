# AJAN B — YAYIN HATTI (PAUSED-ONLY)

Önce oku: `CLAUDE.md` (§16, §17, §18, §20, §22, §44), `HANDOFF.md` (§9, §21.5, §23), `docs/meta/ANALIZ.md`, `docs/meta/CONTRACTS.md`. Sonra bu dosya.
Branch: `meta/agent-b`. Port 3001. Sahip olduğun dosyalar: CONTRACTS §5. **Deploy/push yok.**

## 1. Amaç

Onaylı creative + kampanya planı + seçilmiş Meta varlıkları → **gerçek Meta kampanya / ad set / ad / creative nesneleri, hepsi `PAUSED`.**
Ayrıca yayın öncesi karar kalitesini yükselten iki ek: **doğrulanmış hedefleme** ve **Meta'nın kendi erişim tahmini**.

Mevcut PublishKit (kopyala-yapıştır kiti) **kalır**. Senin yolun onun alternatifi: "Meta'ya bağlıysan tek tıkla taslak kur."

## 2. t=0 — A'yı beklerken (şema/istemci gelmeden)

1. **Doğrulama işi (kod yazmadan).** Kullanacağın **her** ucu güncel resmi dokümandan doğrula, `docs/meta/SOURCES-B.md`'ye kaynak + retrieved_at ile yaz:
   - Kampanya oluşturma: zorunlu alanlar, geçerli `objective` değerleri (yeni ODAX adları), `special_ad_categories` zorunluluğu, `status` alanı.
   - Ad set: `daily_budget` / `lifetime_budget` birimi (**kuruş mu, hangi para birimi?** — yanlışı 100× bütçe demek), `billing_event`, `optimization_goal`, `promoted_object`, `targeting` şeması, zaman alanları.
   - Ad creative: `object_story_spec` (page_id zorunlu), link data alanları, `instagram_actor_id`/`instagram_user_id` (hangisi güncel?), CTA tipleri.
   - Ad: `creative`, `adset_id`, `status`.
   - Hedefleme arama: arama/gözat uçları ve dönen nesnelerin `targeting` içinde nasıl kullanıldığı.
   - `delivery_estimate`: girdi, `daily_outcomes_curve`'un ne zaman boş döndüğü (PHASE0 §1.5'i teyit et).
   - Medya yükleme: görsel (`hash`) ve video uçları, boyut/format sınırları.
   - Önizleme (`generatepreviews`): geçerli `ad_format` değerleri.
2. **Kaynak dosyası borcu:** `apps/web/src/lib/publish-kit/meta-fields.ts` var olmayan `docs/META-ADS-MANAGER-FIELDS.md`'ye referans veriyor. Bu dosyayı doğruladığın kaynaklarla yeniden üret (§37 izlenebilirlik).
3. Saf fonksiyonları yaz (Prisma'sız, test edilebilir): `plan + creative + binding → Meta payload` üreticileri. A'nın istemcisi gelmeden bunlar node testiyle koşar.

## 3. İşler

### B1 — Hedefleme seçici
- AI'ın kampanya planındaki serbest metin kitle önerisi **girdi** olur; kullanıcı gerçek Meta hedefleme nesnelerini arayıp seçer.
- Seçilen hedefleme `CampaignPlan.metaTargeting` (Json) alanında saklanır — şema t=0'da hazır.
- **Kural:** AI hedefleme ID'si uydurmaz; yalnız aramadan dönen nesneler kullanılır (CLAUDE.md §6).
- Özel reklam kategorisi (kredi/istihdam/konut/sosyal) sorusu kullanıcıya sorulur, `CampaignPlan.specialAdCategories`'e yazılır — yanlış cevap Meta reddi demektir; varsayılan seçilmez.

### B2 — Erişim/teslimat tahmini ekranı
- Girdi: seçilmiş hedefleme + optimizasyon hedefi + bütçe (kullanıcıdan; AI bütçe belirlemez — §19).
- Meta `daily_outcomes_curve` vermezse ekran **"Insufficient Data — Meta bu hedefleme için güvenli tahmin üretmiyor"** der. Kendi sayımızı **üretmeyiz** (CLAUDE.md §6/§31, HANDOFF §22.3).
- Gösterilen her sayının yanında kaynak: "Meta delivery estimate, <tarih>".

### B3 — Medya yükleme
- Onaylı creative'in görseli (`CreativeImage`, DB'de bytea) → ad account'a yüklenir, `image_hash` saklanır.
- Boyut/format/oran sınırları doğrulanır; sınır dışıysa kullanıcıya **hangi sınır** ihlal edildiği yazılır.
- Video bu sprintte kapsam dışı (üretim yok) — yalnız kullanıcı yüklediği video varsa değerlendir, yoksa atla.

### B4 — Yayın hattı (çekirdek)
- Akış: **Önizleme → Kullanıcı onayı → Oluştur (PAUSED).** Onaysız tek nesne oluşmaz (CLAUDE.md §16, §20, HANDOFF §9).
- Aşama aşama, `MetaPublish.stage` üzerinden ilerler (Vercel 60 sn): CAMPAIGN → ADSET → CREATIVE → AD. Her aşama DB'ye yazar, idempotent, **claim'li** (Arena'daki `claimedAt` deseninin aynısı — çift tetikleme çift kampanya demektir).
- Her adımda `assertPublishAllowed` + `assertSafePayload` (A'nın `lib/meta/guards.ts`'i) çağrılır. **Bunları atlayan tek bir yol bile olmayacak.** Oluşturma çağrılarında `status: "PAUSED"` ve bütçe = kullanıcının onayladığı plan bütçesi; mevcut nesneye giden çağrıda bütçe/status alanı **hiç** gönderilmez.
- Kısmi başarısızlık: örneğin ad set patlarsa kampanya PAUSED ve boş kalır → kullanıcıya "Meta'da şu nesneler oluştu, şu adımda durdu" dürüst özeti + tekrar deneme (aynı nesneleri **yeniden oluşturmaz**).
- Sonuç ekranı: oluşan nesnelerin ID'leri + Ads Manager derin linkleri + "Yayına almak için Ads Manager'dan sen aktif edeceksin" açık notu.

### B5 — Resmi önizleme
- `generatepreviews` ile yerleşim bazlı gerçek render; mevcut nötr çerçeveler (`components/preview/*`) **kalır** ve bağlantısız kullanıcıya gösterilir.
- Önizleme başarısızsa nötr çerçeveye düş + neden yazılsın.

## 4. Kırmızı çizgiler (senin için ekstra)

- **Bu sprintte ACTIVE eden kod yazmıyorsun.** `status: "ACTIVE"`, `daily_budget` güncelleme, `bid_amount` değişimi — hiçbiri yok. Kod tabanında aranınca bulunmamalı.
- Bütçe birimi hatası en pahalı hatadır: birimi doğrula, birim testine yaz, UI'da kullanıcıya **ad account para biriminde** göster.
- Meta'ya giden hiçbir metin AI tarafından son anda üretilmez; yalnız **onaylanmış** creative alanları gider (§16).
- Rakip metni/görseli kullanma (CLAUDE.md §13).

## 5. Test kanıtı (zorunlu)

1. Gerçek test ad account'ta uçtan uca: kampanya + ad set + ad + creative **PAUSED** oluştu (ID'ler + Ads Manager'da doğrulandı).
2. `delivery_estimate` hem dolu hem boş senaryoda denendi; boşken ekran Insufficient Data dedi.
3. Payload üreticileri birim testli (özellikle bütçe birimi ve `object_story_spec`).
4. Page bağlı değilken yayın butonu **kapalı** ve nedeni yazıyor.
5. Çift tıklama / çift tetikleme testinde **tek** kampanya oluştu (claim çalıştı).
6. `assertSafePayload` yolun içinde: (a) ACTIVE payload reddedildi, (b) plan bütçesinden farklı bütçe reddedildi, (c) mevcut nesneye bütçe güncellemesi reddedildi.

## 6. Rapor

`docs/meta/REPORT-B.md`: yapılanlar, doğrulanan uçlar (SOURCES-B), test kanıtları + gerçek nesne ID'leri, A ve C'ye notlar, açık kalanlar (özellikle A'dan istediğin şema alanları).
