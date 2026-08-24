# RAPOR — AJAN A: ARENA (Creative Evolution Engine) + ortak şema

Tarih: 2026-08-23/24. Branch: `sprint/agent-a`. Deploy/push YAPILMADI; birleştirme kullanıcıda (sıra A → B → C).

## 1. Commit'ler (B ve C için)

| # | Commit | İçerik | B/C aksiyonu |
|---|---|---|---|
| 1 | `4e4ff1a` | **Ortak migration** `20260823150335_arena_kit_brand_assets` — CONTRACTS §3 diff'inin tamamı (Arena + PublishKit/CampaignPlan alanları + BrandAsset/Brand alanları) + `lib/options.ts` `CAMPAIGN_GOALS`/`EVOLUTION_LIMITS` | cherry-pick (yapıldı) |
| 2 | (bu rapor ile aynı commit) | Motor + action + UI + testler + **ikinci küçük migration** `20260823183001_arena_round_attempts` (`EvolutionRound.stageAttempts Int @default(0)`, yalnız A'nın modeli) | Ortak dev DB'ye zaten uygulandı; B/C'nin Prisma client'ı bu kolonu bilmese de çalışır (default'lu). Birleştirmede A→B→C sırası yeterli; ayrıca cherry-pick istenirse yalnız `schema.prisma` + migration klasörü gerekir. |
| 3 | `51cd183` | Sessizce kesilen aşama için deneme sınırı (`stageAttempts > MAX_STAGE_ATTEMPTS` → koşu, aşamaya girmeden FAILED; süreç 60 sn'de ölürse `handleStageError` koşmadığı için aşama sonsuza dek yeniden deneniyordu). Yalnız `lib/evolution/run.ts`. | Şema değişikliği yok; A branch'i merge edilince gelir, cherry-pick gerekmez. |

Sözleşme dışı şema ekleri (ikisi de yalnız `EvolutionRound`, A'nın modeli): `generateAttempts` (lint'te tüm adaylar elenince GENERATE tekrarı sayacı) ve `stageAttempts` (geçici sağlayıcı hatasında aşama tekrar sayacı, §4).

## 2. Yapılanlar (dosya sahipliği CONTRACTS §5'e uygun)

- `packages/db/prisma/schema.prisma` + 2 migration.
- `src/lib/options.ts`: yalnız ekleme (`CAMPAIGN_GOALS`, `EVOLUTION_LIMITS`).
- `src/lib/evolution/`
  - `lint.ts` — deterministik lint, saf; 9 kural (AGENT-A §4 tablosu birebir; kelime listeleri/eşikler dosya başında sabit). Sayısal iddia kaynağı = araştırma JSON + `Brand.products/description/brandVoice/usp/name/website` + teklif + yönlendirme; **pattern analizi bilinçli olarak kaynak DEĞİL** (rakip reklamındaki sayı markanın iddiası olamaz). `< 10` çıplak sayılar (iddia kelimesi yoksa) iddia sayılmaz; "5 yıldız", "binlerce müşteri" iddia sayılır.
  - `select.ts` — saf: ağırlıklı jüri puanı (1-10 → 0-100), jüri sıralaması geçersizse puandan türetilmiş sıralama, Borda (0-100), `total = 0.55·jüri + 0.25·Borda + 0.20·lint`, deterministik tie-break, elit seçimi, yakınsama (`low_gain` < 2 / `same_winner` soy zinciri), confidence (kazananın jüri puanları std sapması + 1. sıra oy çoğunluğu), 4 jüri personası ve ağırlıkları.
  - `prompts.ts` — üretim promptu `lib/creatives/prompts.ts` kurallarını **metin olarak** miras alır (+ strateji eksenleri, mutasyon operatörleri, elit/eleştiri girdileri, teklif yokken yasaklı kelime listesi lint'ten türetilir); jüri promptu persona + "sayı tahmin etme, yalnız kıyasla" + şema. Adaylar promptta kısa etiketle (`A1..An`, `E1..`) geçer, id'ye kodda çevrilir.
  - `run.ts` — aşama makinesi: `advanceEvolution(runId)` tek aşama ilerletir, idempotent, **claim** ile yarış korumalı (`updateMany` koşullu; 90 sn'den eski claim devralınır), her aşama DB'ye yazar. Tur 0 tohum (her aday farklı eksen), tur ≥1 elitler ELITE olarak taşınır + mutasyon çocukları + 1 crossover (tek çağrı). JUDGE: her jüri tek çağrıda tüm adayları görür; jüriler paralel; **kısmi kalıcılık** (biten jüri hemen `judgeOutput`'a DB'de birleştirilerek yazılır → zaman aşımından sonra yalnız eksik jüri koşar). Bitişte kazanan + 2 aday `CreativeGeneration(status COMPLETED, finishedAt dolu, instruction "Arena koşusu <id>")` altında `Creative` PENDING; `summary` (convergence, winnerRationale — jüri eleştirilerinden deterministik derlenir, ek AI çağrısı yok — confidence, dataBasis, disclaimer). Token sayımı tur + koşu düzeyinde (`increment`; sayaçlar 0'dan başlar — NULL üzerine increment NULL kalıyordu, düzeltildi). İptalde de harcanan token kaydedilir.
  - `constants.ts` — UI/prompt ortak sabitleri (etiketler, disclaimer, eksenler, operatörler).
  - `__tests__/lint.test.ts`, `__tests__/select.test.ts` — 23 test (`node --test` + `tsx`).
- `src/actions/evolution.ts` — CONTRACTS §4 imzaları birebir: `startEvolutionRun` (kapılar: sahiplik, COMPLETED araştırma, aktif koşu yok, `EVOLUTION_LIMITS` + `goal ∈ CAMPAIGN_GOALS` zod doğrulaması, `survivors < population`), `advanceEvolutionRun`, `cancelEvolutionRun`, `promoteCandidates` (+ form sarmalayıcı `promoteCandidateForm`). Hepsi `requireUser()` + workspace sahipliği; audit: `evolution.started/advanced/retried/failed/completed/promoted/cancelled`.
- `src/components/evolution/arena-poller.tsx` (3 sn; in-flight koruması), `arena-forms.tsx` (başlatma formu + gelişmiş ayarlar + "Tahmini AI çağrısı: tur × (1 + jüri)"; iptal; manuel aktarım butonu).
- `src/app/app/brands/[id]/arena/page.tsx` (liste + yeni koşu) ve `arena/[runId]/page.tsx` (tur zaman çizelgesi, aşama çipleri, aday kartları: lint/jüri/Borda/toplam, jüri eleştirileri, elenme nedeni, ebeveyn bağlantısı, kazanan kartı + Creative Studio linki, özet + disclaimer). `maxDuration = 60` her iki sayfada.
- `apps/web/package.json`: yalnız `tsx` dev-dep + `test` script'i (AGENT-A §4'ün izin verdiği kadar; B `sharp` eklerken satır çakışması olabilir — önemsiz).

## 3. Kırmızı çizgi kontrolü

- Tahmini CTR/CPC/ROAS/erişim hiçbir yerde üretilmez: jüri promptu yasaklar, şema yalnız 1-10 boyut puanı + eleştiri alır, UI'da tek metrik göreli skorlar. Disclaimer: form, liste sayfası, koşu sayfası, `summary.disclaimer` ve Creative `why` alanında.
- Teklif yalnız kullanıcı verdiyse: promptta + lint `offer_without_permission` (hard) + UI notu.
- Kapılar korunur: COMPLETED araştırma şart; onaysız creative kite giremez (aktarılanlar PENDING).
- Meta yapısı yazılmadı; secrets yok; deploy/push yok.

## 4. Canlı test kanıtı (gerçek Gemini, dev DB)

Motor seviyesi (harness: `apps/web/.data/arena-harness.ts`, git-ignore'lu; `server-only` NODE_PATH stub'ı ile Next dışında koşturulur):

- **Tam koşu 3 tur × 4 aday × 2 jüri** (`cmt64w38p0001vl178fs87u5y`): aşama geçişleri `GENERATE→LINT→JUDGE→SELECT` her tur audit'li; 3 eşzamanlı `advance` → yalnız 1'i iş yaptı (4 aday, 1 audit); tur 1'de ELITE×2 + MUTATION + CROSSOVER; erken yakınsama (`low_gain`) 2. turda; kazanan + 2 aday Creative PENDING, generation COMPLETED+finishedAt; confidence medium; summary dolu.
- **Sekme kapat/aç** (`cmt64zrzy0001vl31hxc9xklh`): 3 adım ilerletilip durduruldu (SELECT, claim boş), ayrı süreçte devam etti → tur 1. Bu koşuda Gemini 120 sn zaman aşımı JUDGE'da koşuyu FAILED yaptı → **geçici hata yeniden deneme** eklendi (§ aşağıda).
- **Geçici hata yolu** (`cmt658v0y0001vlbpnkf9ta3r`, fetch'e enjekte TimeoutError): 1. deneme → `evolution.retried`, aşama korundu, claim bırakıldı; 2. deneme → eksik jüri koştu, SELECT; tükenme: 3 denemede FAILED, mesaj "(3 denemede de geçici hata — tur 2, aşama GENERATE)".
- **İptal** (`cmt65e0600001vlf3oxra3ev4`): AI çağrısı uçarken iptal → sonuç yazılmadı, claim bırakıldı, token kaydedildi.

UI seviyesi (headless Chrome + `browse` CLI, port 3000; test kullanıcısı `arena-test@ornek.dev`, davet tablosuna eklenen davetle kayıt; marka `Örnek Kahve (Arena UI testi)` `cmt65konr0004vl0bgti3sr04` — araştırma/rakip/pattern/öğrenme satırları Örnek Kahve'den kopyalandı, çünkü `test@ornek.dev` şifresi bilinmiyor):

- Form: gelişmiş alanlar, "Tahmini AI çağrısı: 9" (3×(1+2)); başlatınca koşu sayfasına yönlendirme.
- **UI tam koşu** (`cmt65m4o00007vl0bnvz8jsb6`, teklif "İlk siparişe kargo bedava"): poller ile 2 tur, erken yakınsama, kazanan CROSSOVER (toplam 88.69), 1 gerçek `evolution.retried` (sağlayıcı 503/zaman aşımı) sonrası kendiliğinden toparladı; token 14013/4513; Creative Studio'da 3 PENDING; "Onay akışına gönder" ile 4. aday manuel aktarıldı (generation "— manuel seçim").
- **Tenant izolasyonu**: başka workspace'in `/arena` ve `/arena/[runId]` URL'leri → 404 (dev log'da doğrulandı).
- **Sekme kapat/aç (UI)** (`cmt6fb4oy0019vl0bqt9nh22b`): sayfa kapatılınca after() yalnız ilk aşamayı koştu, 105 sn LINT'te bekledi; sayfa açılınca JUDGE'a ilerledi. İptal butonu çalıştı ama **31 sn gecikti** (React aynı istemcinin action'larını sıraya koyuyor; aşama action içinde koşuyordu) → `advanceEvolutionRun` artık aşamayı `after()` ile koşturup hemen dönüyor.
- **İptal (düzeltme sonrası)** (`cmt6fgwta001ovl0bgn2pl91x`): JUDGE uçarken iptal → **2 sn**'de CANCELLED, `evolution.cancelled` audit'i userId'li, uçan aşamanın sonucu yazılmadı, sayfada "Koşu iptal edildi" notu.

Kalite kapıları: `pnpm test` 23/23; `pnpm build` temiz (arena route'ları listede); `tsc --noEmit` temiz; kendi dosyalarım `eslint` temiz. **`pnpm lint` repo genelinde 20 hata / 12 uyarı veriyor — hepsi sprint öncesi mevcut dosyalarda** (`theme-toggle.tsx`, `count-up.tsx`, `reveal.tsx`, `campaigns/*`, `competitors/*`, `research-section.tsx`, `actions/*` unused `_prev`… — `react-hooks/set-state-in-effect` vb.), A'nın hiçbir dosyasında değil; dokunmadım (sahiplik).

## 5. Bilinen sınırlar / notlar

- **Süre**: GENERATE 10-50 sn, JUDGE (paralel) 20-60 sn ölçüldü (Gemini o an yavaş/503'lü idi, model fallback `gemini-3.6/3.5-flash`). Vercel 60 sn'de aşama kesilirse claim 90 sn sonra devralınır ve aşama yeniden koşar (JUDGE'da yalnız eksik jüriler); üst sınır `MAX_STAGE_ATTEMPTS = 3`. Aday sayısı 8-10 ile üretim çağrısı 60 sn'yi aşabilir → varsayılan 6 makul; `GEMINI_MODEL` ile hızlı model sabitlenebilir.
- **Erken yakınsama agresif**: jüri puanları turlar arası gürültülü; iki canlı koşu da 2. turda `low_gain` ile durdu (tur 1 en iyi toplamı tur 0'ı geçemedi). Spec'e uygun; gevşetmek için `CONVERGENCE_MIN_GAIN` (select.ts) veya kıyası "şimdiye kadarki en iyi" üzerinden yapma seçeneği.
- Crossover çocuğu bazen ebeveyn hook'unu aynen taşıyor (model davranışı); `duplicate_sibling` yalnız gövde+başlık benzerliği > 0.6'da cezalandırır.
- Cancel edilen koşuda uçan aşama bitince claim serbest kalır; koşu bir daha ilerlemez.
- İptal audit'i action'da; harness'ın doğrudan DB iptali audit üretmez (beklenen).
- UI, `components/ui.tsx` + mevcut çip/kart dilini kullanır; yeni görsel dil yok.
- Dev DB'de bırakılan test verisi: kullanıcı `arena-test@ornek.dev` + workspace, marka `cmt65konr0004vl0bgti3sr04` (fixture kopyaları `*_arena_ui_fixture`), davet `inv_arena_ui_test`, Örnek Kahve altında 4 koşu + 3 Creative (ilk harness koşusundan). Silinebilir.
- Operasyonel: bu makinede Postgres `postmaster.pid` reboot sonrası bayat kalmıştı (PID başka sürece gitmiş) → silinip servis yeniden başlatıldı.

## 6. Diğer ajanlara notlar

- **C (wizard/marka sayfası)**: "Arena →" linki `/app/brands/[id]/arena`; koşu durumu için `EvolutionRun.status` (`QUEUED|RUNNING|COMPLETED|FAILED|CANCELLED`), kazanan `winnerCreativeId`, `summary.promotedCreativeIds`. Aktif koşu varken `startEvolutionRun` `{ error, runId }` döner (mevcut koşuya link verilebilir). `advanceEvolutionRun` artık hemen döner (aşama after() ile) — wizard kendi poller'ında `ArenaPoller` desenini kullanabilir (`components/evolution/arena-poller.tsx`, prop: `runId`).
- **B (kit)**: Arena'dan gelen creative'ler normal `Creative` kayıtlarıdır (PENDING → kullanıcı onaylar); ek alan yok. `why` sonunda "[Arena: tur N, sıra R, toplam skor S — disclaimer]" eki var; kitte gösterilecekse disclaimer'la birlikte gösterilmeli, skor performans göstergesi gibi sunulmamalı.
- Her iki ajan: ikinci migration (`arena_round_attempts`) ortak dev DB'de uygulanmış durumda; kendi `prisma migrate dev` çalıştırırken "drift" uyarısı alırsanız A'nın branch'ini merge/cherry-pick edin, reset ETMEYİN.

## 7. HANDOFF'a girecek özet (kullanıcı birleştirdikten sonra)

ARENA (Creative Evolution Engine) tamam ve canlı test edildi (2026-08-24): `EvolutionRun/Round/Candidate`; tur = GENERATE→LINT→JUDGE→SELECT, her aşama ayrı çağrı + claim yarış koruması + geçici hatada 3 deneme; deterministik lint (9 kural, 23 test) + 2-4 personalı AI jüri (tek çağrıda tüm adaylar) + Borda birleştirme; erken yakınsama; kazanan + 2 aday Creative PENDING'e; `/app/brands/[id]/arena` ve `/arena/[runId]`; audit `evolution.*`. Skor göreli sıralamadır, performans tahmini üretilmez. Varsayılan 4×6×2×3 (~16 çağrı), sınır 8×10×3×4.
