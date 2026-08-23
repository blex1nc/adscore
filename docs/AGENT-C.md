# AJAN C — Launch Wizard + Marka Zenginleştirme + Reklam Önizleme

Önce oku: `CLAUDE.md`, `HANDOFF.md` (§14, §21), `docs/CONTRACTS.md`. Sonra bu dosya.
Branch: `sprint/agent-c`. Sahip olduğun dosyalar: CONTRACTS §5. Deploy/push yok.
Şema: migration'ı Ajan A yazar; gelene kadar §4 (önizleme) ve §3'ün iskeletini yap, sonra A'nın commit'ini cherry-pick et.

## 1. Amaç

Kullanıcı için **tek akış**: marka oluştur → sistem araştırsın → Arena'da reklam yarıştırsın → kullanıcı onaylasın → plan çıksın → kit ile Ads Manager'da kursun → sonuç girsin. Bugün bu parçalar ayrı sayfalarda ve kullanıcı sırayı bilmek zorunda. Ayrıca üretim kalitesi için markanın **ses/USP/ürün/logo** bilgisi eksik — bunlar eklenir. Reklamlar, kullanıcı onaylamadan önce **Akış / Hikâye / Reels** çerçevelerinde gerçekçi önizlenir.

Bu sprintte landing sayfasına dokunulmaz; üç istek de panel özelliği.

## 2. Marka profili zenginleştirme

- `actions/brands.ts`: `updateBrandProfile` (brandVoice ≤300, usp ≤300, products: JSON dizi ≤20 öğe, her öğe `{ name, price?, url?, description? }` — **fiyatı kullanıcı girer**, sistem asla üretmez), `uploadBrandAsset` (kind, dosya ≤2 MB, `image/png|jpeg|webp` — **SVG kabul edilmez** (kullanıcı SVG'si servis edilirse stored-XSS)), `deleteBrandAsset`. Sahiplik + audit.
- `GET /api/brand-assets/[id]`: auth + tenant korumalı servis (`/api/creative-images/[id]` deseniyle birebir).
- `components/brand-form.tsx`: mevcut forma "Marka sesi", "Ayrıştırıcı değer", ürün listesi (satır ekle/sil) bölümleri; `brands/[id]/page.tsx`'e asset yükleme/listeleme (logo ayrı vurgulu).
- **Sözleşme notu:** Ajan A'nın Arena promptu `brandVoice/usp/products` alanlarını okuyacak (alan adları CONTRACTS §3'te sabit). Sen prompt'a dokunmazsın.

## 3. Launch Wizard — `/app/brands/[id]/launch`

Durum makinesi **DB'den türetilir**, ayrı state tutulmaz:

| Adım | Hazır sayılma koşulu | Aksiyon (mevcut/A/B) |
|---|---|---|
| 1 Marka profili | `website` + (`description` veya `usp`) | `updateBrandProfile` |
| 2 Araştırma | son `ResearchRun` COMPLETED | mevcut `startResearch` (actions/research.ts) |
| 3 Rakipler (opsiyonel) | ≥3 analizli `CompetitorAd` → pattern COMPLETED; yoksa "atla" | mevcut competitors action'ları; atlanırsa rozet: "pattern verisi olmadan üretim, güven düşer" |
| 4 Arena | son `EvolutionRun` COMPLETED | **A'nın action'ını import ETME** (senin worktree'nde yok). Yalnız DB'den `EvolutionRun` oku (migration sonrası tip var) ve `/arena` / `/arena/[runId]`'ye link ver; koşu başlatma A'nın sayfasında yapılır |
| 5 Onay | ≥1 `Creative` APPROVED | mevcut approve/reject/update (actions/creatives.ts) + §4 önizleme |
| 6 Plan | son `CampaignPlan` COMPLETED | mevcut `startCampaignPlan` (bütçe kullanıcıdan — CLAUDE.md §19; form bu adımda) |
| 7 Kit & yayın | `CampaignPlan.publishedAt` dolu | **B'nin action'ını import ETME.** Yalnız `/campaigns/[planId]/kit` linki; "yayınladım" işareti kit sayfasında (B) |
| 8 Sonuç | ≥1 `CampaignResult` | mevcut result-forms / CSV import linki |

- Sayfa: üstte adım şeridi (tamam / aktif / kilitli / atlandı), ortada **yalnız aktif adımın** formu/özeti, altta "sonraki adım" ve "bu adımı detay sayfasında aç" linkleri. Süren iş varsa (`RUNNING`) poller (`research-poller` deseni; Arena için A'nın `arena-poller`'ını **kullanma**, kendi `router.refresh()` poller'ın yeter — Arena'yı ilerleten A'nın sayfasıdır; wizard "Arena sayfasında izle →" der).
- Kapılar **bypass edilmez**: araştırma yoksa Arena düğmesi kilitli + neden yazısı; onaysız creative ile plan yok; plan olmadan kit yok.
- Gelişmiş kullanıcı için her adım detay sayfasına link; wizard bir "yönlendirici"dir, mevcut sayfaları kopyalamaz (`components/launch/*` içinde ince sarmalayıcılar; formları mevcut bileşenlerden import et: `research-start-form`, `creative-forms`, `campaign-forms`, `result-forms`).

## 4. Reklam önizleme — `components/preview/*`

- `AdPreview({ creative, image?, brand, placement: "feed"|"story"|"reels" })`: nötr çerçeveler (telefon silueti, üstte marka adı + logo `BrandAsset` varsa, görsel alanı oranı: feed 1:1 veya 4:5, story/reels 9:16, altta primary text — ilk 125 karakter + "…daha fazla", headline, CTA düğmesi, description). **Instagram/Facebook logosu, ikon seti veya isim kullanılmaz**; sekme etiketleri "Akış / Hikâye / Reels".
- Primary text'te 125 karakter işaretçisi (kesim noktasını göster) ve headline 40 karakter sayacı — A'nın lint'iyle aynı eşikler (CONTRACTS'ta sabit değil; aynen 125/40 kullan).
- Creative Studio sayfası (`creatives/page.tsx`) senin değil; önizlemeyi **wizard'ın 5. adımına** ve marka sayfasındaki "son onaylı creative" kartına koy. Creative Studio'ya entegrasyon isteğini REPORT-C'de not et.
- Dark/light tema token'larıyla; ham renk yok.

## 5. Dashboard ve gezinme

- `app/app/page.tsx`: marka başına "Launch durumu" kartı (hangi adımda, sonraki aksiyon, süren iş var mı) — sahte metrik yok; sayı yalnızca gerçek kayıt sayıları.
- `sidebar-nav.tsx`: "Markalar" altında hiçbir şey değişmez; marka sayfasına giden kartlarda "Başlat →" (`/launch`). Marka sayfasına linkler: "Launch", "Arena →" (`/arena`), plan kartlarında "Kurulum kiti →" (`/campaigns/[planId]/kit`). A/B merge edilmeden 404 olması normal.
- `components/ui.tsx`'e yalnız ekleme (ör. `Stepper`, `CopyButton` gerekiyorsa B de kullanabilir — ekledinse REPORT'ta yaz).

## 6. Doğrulama

- Canlı (gerçek Gemini): yeni marka → profil + logo + ürün → araştırma → (rakip atla) → Arena adımı kilit/açık doğru → (A merge'üne kadar) mevcut creative üretimiyle 5. adım → önizleme 3 yerleşimde → plan → 7/8 adım linkleri.
- Asset servisi tenant testi (başka kullanıcı → 404), 2 MB üstü ve yanlış MIME reddi.
- Poller'ların süren iş yokken durması.
- `pnpm lint`, `pnpm build`.
- `docs/REPORT-C.md` (CONTRACTS §6).
