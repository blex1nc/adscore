# AJAN C RAPORU — Launch Wizard + Marka Zenginleştirme + Reklam Önizleme

Tarih: 2026-08-24. Branch: `sprint/agent-c` (worktree `/Users/toprak/adscore-agent-c`).
Ajan A'nın migration commit'i (`4e4ff1a`, `20260823150335_arena_kit_brand_assets`) cherry-pick edildi (`69339f9`).
Deploy ve `git push` YAPILMADI. `HANDOFF.md` / `CLAUDE.md` / şema / A–B dosyalarına dokunulmadı.

## 1. Yapılanlar

### 1.1 Reklam önizleme — `components/preview/*`
- `ad-preview.tsx`: `AdPreview({ creative, imageUrl?, brand, placement, feedRatio? })`. Nötr telefon silueti; **Instagram/Facebook logosu, ikonu, adı YOK**; sekmeler "Akış / Hikâye / Reels". Akış 1:1 veya 4:5, Hikâye/Reels 9:16. Üstte marka adı + logo (`BrandAsset` LOGO varsa, yoksa baş harf), "Sponsorlu" etiketi; altta primary text (ilk **125** karakter + "…daha fazla" işaretçisi), başlık, açıklama, CTA.
- `CharMeters`: primary text N/125 (katlanan karakter sayısı) ve başlık N/40 sayacı (aşımda destructive). Eşikler AGENT-C §4'teki 125/40.
- Dikey çerçeveler (Hikâye/Reels) `data-theme="dark"` ile token katmanına kilitlenir → görsel üstü karartma ve metin her sayfa temasında okunur; **ham renk yok**.
- `preview-tabs.tsx` (client): sekmeler + 1:1/4:5 seçici + sayaçlar. Saf props (serileştirilebilir), server/client sınırı sorunu yok.

### 1.2 Marka profili zenginleştirme
- `actions/brands.ts` (genişletme):
  - `updateBrandProfile(brandId, _prev, formData)`: `brandVoice` ≤300, `usp` ≤300, `products` JSON dizi ≤20, öğe `{ name, price?, url?, description? }`. **Fiyat yalnız kullanıcıdan**; boş liste → `DbNull`.
  - `uploadBrandAsset(brandId, _prev, formData)`: `kind` ∈ LOGO/PRODUCT_IMAGE/OTHER; dosya ≤2 MB; yalnız `image/png|jpeg|webp`; beyan edilen MIME **ve** imza baytları (PNG/JPEG/RIFF-WEBP) birlikte doğrulanır; **SVG reddedilir** (stored-XSS). Marka başına ≤30 asset. Dosya adı kontrol karakterlerinden temizlenir.
  - `deleteBrandAsset(formData)`: assetId; sahiplik kontrolü.
  - Hepsi `requireOwnedBrand` (workspace.ownerId) + `audit()`; `/app/brands/[id]`, `/launch`, `/app` revalidate.
- `components/launch/brand-profile-limits.ts`: sınırlar tek yerde (action + formlar). `"use server"` dosyası sabit export edemediği için ayrı modül.
- `components/brand-form.tsx`: `BrandForm` değişmedi; yeni `BrandProfileForm` (ses/USP/ürün satırı ekle-sil, JSON hidden input) ve `BrandAssetUploadForm` (tür + dosya; istemci tarafı erken 2 MB uyarısı — asıl kapı sunucuda).
- `components/launch/brand-profile-section.tsx` (server): profil formu + logo (son yüklenen LOGO vurgulu) + diğer görseller ızgarası + yükle/sil. Marka sayfası ve wizard 1. adım aynı bileşeni kullanır.
- `GET /api/brand-assets/[id]`: `/api/creative-images/[id]` deseniyle birebir — auth (401) + tenant (404); `content-type` doğrulanmış mimeType, `x-content-type-options: nosniff`, `content-disposition: inline`, `cache-control: private`.
- Logo kararı: yeni logo yüklemek eskisini **silmez** (kullanıcı verisi otomatik silinmez); en son yüklenen LOGO aktif sayılır, eskisi kullanıcı tarafından silinir.

### 1.3 Launch Wizard — `/app/brands/[id]/launch`
- `components/launch/launch-state.ts`: 8 adımlı durum makinesi **DB'den türetilir**; ayrı state yok. Tek `brand.findFirst` (nested take:1 include + `_count`) + bridge.
  - Hazır koşulları AGENT-C §3 tablosuyla aynı: 1 website+(açıklama∨USP); 2 COMPLETED research; 3 pattern COMPLETED (opsiyonel); 4 son `EvolutionRun` COMPLETED; 5 ≥1 APPROVED creative; 6 son plan COMPLETED; 7 `CampaignPlan.publishedAt`; 8 ≥1 `CampaignResult`.
  - **Adım 4 notu:** Arena önerilen yoldur, ancak Creative Studio'dan gelen creative de "kaynak" sayılır (A merge'üne kadar ve Arena'sız kullanım için). Bu durumda adım "tamam" görünür ve "Arena koşusu yok; creative'ler Creative Studio'dan geldi" notu düşer. Mevcut kapılar (araştırma→copy, onay→plan, plan→kit) bypass edilmez; kilit nedeni yazılır.
  - "Atlandı" kalıcı değildir: araştırma tamam + pattern yok + sonraki adımlarda ilerleme varsa 3. adım "atlandı" rozeti alır ("pattern verisi olmadan üretim; güven düşer"). Araştırma bitip henüz rakip/arena/creative yoksa wizard 3. adımı **önerir** ("Bu adımı atla →" ile 4'e geçilir).
  - `activeIndex` = ilk tamamlanmamış zorunlu adım; `nextAction` metni dashboard'da.
- `components/launch/launch-bridge.ts`: migration'a bağımlı okumalar **tek dosyada** (Brand.usp/brandVoice/products, LOGO asset, `EvolutionRun` yalnız DB okuması, `CampaignPlan.publishedAt` yalnız okuma). Dashboard için toplu (4 sorgu) sürüm. A'nın `actions/evolution.ts` / `lib/evolution` ve B'nin `actions/publish-kit.ts` **import edilmedi**.
- Sayfa: üstte `Stepper` (tamam / sırada / opsiyonel / kilitli / atlandı; süren iş animasyonlu), ortada **yalnız görüntülenen adımın** paneli, altta "Detay sayfasında aç" + "Sonraki adım". Görüntülenen adım URL'de sabit (`?step=n`): parametre yoksa veya kilitli adım istenirse önerilen adıma `redirect`. Böylece form action sonrası yeniden render kullanıcıyı aynı adımda tutar.
- Paneller ince sarmalayıcı; formlar mevcut bileşenlerden import: `BrandForm`, `ResearchStartForm`, `PatternStartForm`, `GenerateForm` (Arena olmadan üret), approve/reject/reset action'ları + `EditCreativeForm` + `GenerateImageButton`, `PlanForm`, `ImportResultForm` + `AddResultForm`. Arena paneli yalnız `/arena` ve `/arena/[runId]` linki + koşu durumu (tur x/y) verir; "Arena skoru adayların birbirine göre sıralamasıdır; gerçek performans tahmini değildir" metni panelde.
- `launch-poller.tsx`: `router.refresh()` 3 sn; yalnız süren iş (`state.running`) varken mount edilir. A'nın arena-poller'ı kullanılmadı.
- `export const maxDuration = 60` (wizard'dan çağrılan action'lar `after()` ile AI koşturur).

### 1.4 Dashboard ve marka sayfası
- `app/app/page.tsx`: marka başına "Launch durumu" kartı — adım k/8 + adı, 8'li ilerleme çizgisi, sıradaki aksiyon, "Sürüyor" rozeti, "Başlat / Devam et →" (`/launch`). "Kayıtlar" kartı yalnız gerçek sayılar (marka / onaylı creative / girilen sonuç). Meta kartı "ertelendi" metniyle güncellendi. Sahte metrik yok.
- `app/app/brands/[id]/page.tsx`: "Launch" (vurgulu), "Arena →" (`/arena`), profil bölümü, "Son onaylı creative" önizlemesi (3 yerleşim, logo ile), "Kampanya planları" listesi — COMPLETED planlarda "Kurulum kiti →" (`/campaigns/[planId]/kit`) ve "Plan →". Silme uyarı metni güncellendi.
- `sidebar-nav.tsx`: değişiklik gerekmedi, dokunulmadı. `components/ui.tsx`: ekleme gerekmedi.

### 1.5 Sahiplik listesi dışı tek dosya: `apps/web/next.config.ts`
`experimental.serverActions.bodySizeLimit: "3mb"` eklendi. Gerekçe: CONTRACTS §4 `uploadBrandAsset`'i **server action** olarak sabitler ve dosya sınırı 2 MB'dir; Next'in varsayılan 1 MB action gövde limiti bu sözleşmeyi karşılayamaz. Dosya hiçbir ajanın listesinde değil; ek satır geri alınabilir, merge çakışması beklenmiyor. Asıl 2 MB sınırı action içinde uygulanır (canlı doğrulandı, §2.3).

## 2. Test kanıtı (dev, gerçek Gemini, PORT=3002, Playwright/Chromium headless)

Kullanıcı: `418off@gmail.com` (dev şifresi). Test markası: **"Kronotrop (Ajan C testi)"** (`cmt65awew0001vlogb5gensnb`, website kronotrop.com.tr) — dev DB'de bırakıldı, silinebilir.

### 2.1 Uçtan uca akış (AGENT-C §6)
| Adım | Sonuç |
|---|---|
| Yeni marka (açıklama BOŞ) | Wizard: 1 "sırada", diğerleri kilitli |
| Profil: ses + USP + 2 ürün (fiyat "349 TL", "1.190 TL", URL) | DB'de `products` JSON birebir, audit `brand.profile_update` (productCount 2). USP ile adım 1 "tamam" (açıklama boş) |
| Logo PNG + ürün JPEG yükleme | Kaydedildi; logo vurgulu kutuda, `/api/brand-assets/[id]` ile servis |
| Araştırma (wizard 2. adım) | COMPLETED, `gemini-3.6-flash`, 1556+1185 token, ~66 sn; sonuç özeti panelde |
| Poller | Araştırma bitince 10 sn içinde **0** RSC tazeleme isteği (durdu); üretim sonrası da 0 |
| Rakipler | Araştırma sonrası wizard 3. adımı önerdi (0 rakip, 0/3 analiz, pattern düğmesi kilitli + neden); "Bu adımı atla →" ile 4'e geçildi |
| Arena | Araştırma tamamken "sırada" + `/arena` linki (A merge'üne kadar 404 — beklenen); araştırma yokken kilit + neden (marka oluşturma anında doğrulandı) |
| Arena olmadan üret (GenerateForm, teklif "İlk siparişe ücretsiz kargo") | 3 varyant üretildi; 3. adım "atlandı", 4. adım "tamam" (not: Creative Studio'dan geldi), 5 "sırada" |
| Onay | 3 kart; sayaçlar "250/125 · 125 karakter katlanır", "30/40"; Akış 1:1 / 4:5, Hikâye, Reels ekran görüntüleri alındı (logo + "Sponsorlu", "…daha fazla" işaretçisi, platform logosu yok). "Onayla" → sayfa **yeniden yüklenmeden** çip "Onaylandı" oldu (mevcut action'ların `revalidatePath`'i wizard'ı da tazeliyor) |
| Plan (500 TRY günlük, SALES) | COMPLETED (gerçek Gemini); 6 "tamam", 7 "sırada" |
| Kit & yayın | `/campaigns/<planId>/kit` linkleri (B merge'üne kadar 404 — beklenen); `?step=8` istenince kilitli → 7'ye düşüldü |
| `publishedAt` (B'nin action'ı DB'de elle simüle edildi) | 7 "tamam", 8 açıldı; elle sonuç girişi (450 TRY / 12.500 gösterim / 310 tıklama) → 8 "tamam"; dashboard "Akış tamamlandı · 1 onaylı creative · 1 sonuç" |
| Marka sayfası | Launch, Arena →, Kurulum kiti → linkleri; son onaylı creative önizlemesi logo ile |

### 2.2 Asset servisi — tenant / MIME / boyut
| Test | Sonuç |
|---|---|
| Auth yok → kendi asset | **401** |
| Sahip → kendi asset | **200**, `image/png`, `nosniff`, `inline`, 570 bayt |
| Sahip → başka workspace'in asset'i (test@ornek.dev markasına geçici satır) | **404** (satır silindi) |
| Olmayan id | 404 |

### 2.3 Yükleme reddi (sunucu mesajları)
| Dosya | Sonuç |
|---|---|
| `evil.svg` (image/svg+xml) | "Yalnız PNG, JPEG veya WebP kabul edilir … SVG güvenlik nedeniyle reddedilir." |
| `fake.png` (metin, image/png beyanı) | "Dosya içeriği beyan edilen görsel türüyle uyuşmuyor; dosya reddedildi." (imza baytı) |
| 2,4 MB PNG, istemci kontrolü **atlatılarak** (`File.size` getter'ı sahte) | Sunucu: "Dosya 2.3 MB; sınır 2 MB." — 3 MB gövde limiti sayesinde action'a ulaştı ve action reddetti |
| 2,4 MB PNG, normal | İstemci erken uyarısı "Dosya 2 MB sınırını aşıyor." |

### 2.4 Kalite kapıları
- `pnpm exec tsc --noEmit`: temiz.
- `pnpm build`: temiz (`/app/brands/[id]/launch`, `/api/brand-assets/[id]` rotaları listede). Prisma `export *` uyarısı `packages/db/src/index.ts` kaynaklı, önceden mevcut.
- `pnpm lint`: **sahip olduğum dosyalar temiz.** Toplam 32 problem (20 hata, 12 uyarı) `main` ile birebir aynı — hepsi mevcut dosyalarda (`react/no-unescaped-entities`, `theme-toggle` set-state-in-effect vb.), bu sprintte dokunulmadı.

## 3. Bilinen sınırlar
- Arena ve kit sayfaları bu branch'te yok → `/arena`, `/campaigns/[planId]/kit` linkleri merge'e kadar 404 (sözleşme gereği normal).
- 7→8 geçişi `publishedAt`'e bağlı; B'nin "yayınladım" action'ı olmadan kullanıcı sonucu yine `/campaigns` sayfasından girebilir (wizard'da 8 kilitli görünür, detay sayfası açık).
- "Atlandı" türetilmiş bir durumdur; kullanıcı 3. adımı atlayıp henüz üretim yapmadıysa wizard bir sonraki ziyarette yine 3'ü önerir (kalıcı state bilinçli olarak yok).
- Marka başına ≤30 asset, asset ≤2 MB DB'de bytea; büyük hacimde S3'e geçiş HANDOFF kararıyla aynı.
- WebP için gerçek örnek dosya üretilemedi (sips desteklemiyor); imza doğrulaması header-only WebP ile doğrulandı, kabul edildi.
- Önizleme görseli `CreativeImage` (COMPLETED) veya yok; `BrandAsset` PRODUCT_IMAGE henüz önizlemeye bağlanmadı (öneri: creative'e görsel seçimi — Creative Studio işi).

## 4. Diğer ajanlara / birleştirmeye notlar
- **B'ye:** `components/campaigns/campaign-forms.tsx` (`PlanForm`), `result-forms.tsx` (`AddResultForm`), `import-form.tsx` (`ImportResultForm`) wizard'dan import ediliyor. Props değiştiyse `components/launch/steps-launch.tsx` uyarlanmalı (merge sırası A→B→C, C'de çözülür).
- **A'ya:** Wizard `EvolutionRun` alanlarından yalnız `status`, `currentRound`, `maxRounds`, `id` okur (`launch-bridge.ts`). `Brand.brandVoice/usp/products` alan adları CONTRACTS §3 ile aynı; `products` öğeleri `{ name, price?, url?, description? }`.
- **A'nın worktree'sinde** (`/Users/toprak/adscore.ai`, `sprint/agent-a`) `schema.prisma` ve `apps/web/package.json` **commit'lenmemiş değişiklikler** görünüyor. İkinci bir migration gelirse C tekrar cherry-pick + `prisma generate` yapmalı.
- Creative Studio (`creatives/page.tsx`, sahibi yok/B değil) kartlarına `PreviewTabs` eklenmesi önerilir (`components/preview/preview-tabs.tsx`, props: creative/imageUrl/brand).
- `app/app/brands/page.tsx` (marka listesi, sahibi yok) satırlarına "Başlat →" (`/launch`) linki eklenebilir; sahiplik dışı olduğu için dokunulmadı.
- `components/ui.tsx`'e ekleme yapılmadı (Stepper `components/launch/stepper.tsx`'te; B `CopyBlock`'u zaten `campaign-forms.tsx`'te tutuyor).
- Dev DB: test markası "Kronotrop (Ajan C testi)" (Admin workspace) ve ona bağlı research/creatives/plan/result kayıtları test verisidir; `publishedAt` elle set edildi. Silinebilir.

## 5. HANDOFF'a girecek özet
- **Launch Wizard** (`/app/brands/[id]/launch`): Marka → Araştırma → Rakipler (ops.) → Arena → Onay → Plan → Kit & yayın → Sonuç; durum DB'den türetilir, `?step=n` ile görüntülenen adım; kapılar korunur, kilit nedeni yazılır; süren işte 3 sn poller (iş bitince durur). Dashboard marka başına launch kartı; marka sayfasında Launch / Arena → / Kurulum kiti →.
- **Marka profili:** `brandVoice`, `usp`, `products` (fiyat kullanıcıdan) + `BrandAsset` (logo/ürün görseli; ≤2 MB, PNG/JPEG/WebP, imza baytı doğrulaması, SVG reddi; `/api/brand-assets/[id]` auth+tenant, nosniff).
- **Önizleme:** `components/preview` — Akış (1:1/4:5) / Hikâye / Reels nötr çerçeveler, 125/40 sayaçları; wizard 5. adım ve marka sayfası "son onaylı creative".
- Yapılandırma: `next.config.ts` `serverActions.bodySizeLimit: 3mb`.
- Canlı test 2026-08-24 (gerçek Gemini): araştırma → 3 varyant → onay → plan zinciri wizard içinden tamamlandı; tenant/MIME/boyut reddi doğrulandı.
