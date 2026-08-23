# FINAL SPRINT — ORTAK SÖZLEŞME (3 AJAN)

Tarih: 2026-08-23. Bu dosya 3 paralel ajanın (A / B / C) **tek ortak referansıdır.**
Her ajan önce `CLAUDE.md`, `HANDOFF.md` (özellikle §14 ve §21) ve bu dosyayı okur; sonra kendi görev dosyasını (`docs/AGENT-A.md` / `AGENT-B.md` / `AGENT-C.md`).

## 0. Sprintin amacı (kullanıcının isteği)

1. Site, **markaya göre reklamı kendisi üretsin** (copy + görsel + hedef + ayar).
2. Reklam yayına çıkmadan önce **Instagram'a benzer bir seçilim mantığıyla birçok kez döndürülsün** ve en verimli aday çıkarılsın → **Arena (Creative Evolution Engine)**.
3. Kullanıcı kazanan reklamı **kendi Ads Manager panelinden** birebir kursun → **Ads Manager Kurulum Kiti v2** (alan alan kopyala-yapıştır + asset'ler + dışa aktarma).
4. Bunların tamamı tek bir akışta (**Launch Wizard**) birbirine bağlansın: Marka → Araştırma → Arena → Onay → Plan → Kit → Sonuç.

Meta API bağlantısı **bu sprintte YOK** (HANDOFF §21.5, kullanıcı kararı). Mock/fake Meta entegrasyonu yazılmaz.

## 1. Kırmızı çizgiler (her ajan için)

- **"Instagram algoritması" = GÖRELİ SIRALAMA, PERFORMANS TAHMİNİ DEĞİL.** Arena skoru adaylar arası kıyastır. Hiçbir yerde tahmini CTR / CPC / ROAS / erişim / etkileşim sayısı ÜRETİLMEZ (CLAUDE.md §6, §31). UI metni: *"Arena skoru adayların birbirine göre sıralamasıdır; gerçek performans tahmini değildir."*
- Sayı/indirim/iddia uydurma yok: teklif (offer) yalnızca kullanıcı verdiyse kullanılır.
- Mevcut kapılar korunur: copy üretimi için COMPLETED araştırma şart; pattern için ≥3 analizli reklam; onaysız creative kampanya/kite giremez (§16).
- Meta yapısı **hafızadan yazılmaz**; Ads Manager alan listesi resmi dokümandan doğrulanır (HANDOFF §23). Bu yalnız Ajan B'nin işi.
- Secrets koda girmez. Deploy ve `git push` YAPILMAZ — birleştirmeyi kullanıcı yapar.
- Vercel fonksiyon limiti 60 sn: uzun işler **adım adım kalıcı** (her adım ayrı çağrı, durum DB'de) ve poller ile sürer (`components/research/research-poller.tsx` deseni).
- AI çağrıları sayılır (`promptTokens`/`outputTokens`) — mevcut run modelleriyle aynı.
- Dil: panel TR; kod yorumları TR; copy dili marka ayarından (`Brand.copyLanguage`).

## 2. Çalışma düzeni ve çakışma önleme

- Her ajan kendi branch'inde çalışır: `sprint/agent-a`, `sprint/agent-b`, `sprint/agent-c` (`git worktree add ../adscore-agent-b sprint/agent-b` önerilir). Ortak dev DB `adscore_dev`.
- **Şema tek elden:** `packages/db/prisma/schema.prisma` + migration'ı yalnız **Ajan A** yazar, **ilk iş olarak** (Bölüm 3'teki diff'in tamamı — B ve C'nin alanları dahil) tek migration: `20260823_arena_kit_brand_assets`. A bunu commit'leyince B ve C kendi branch'lerine `git cherry-pick` eder (ya da A'nın branch'ini merge eder). A'nın migration commit'i gelene kadar B/C şemaya bağımlı olmayan işleri yapar (B: doküman doğrulama + kit builder saf fonksiyonları; C: preview bileşenleri + wizard iskeleti).
- Üç `next dev` aynı anda 3000'e çakışır: A `PORT=3000`, B `PORT=3001`, C `PORT=3002` (`pnpm dev -- -p 3001`).
- Migration sonrası **dev server yeniden başlatılır** (HANDOFF notu: Prisma client bellekte eski kalıyor).
- Dosya sahipliği (Bölüm 5) kesindir. Başkasının dosyasına ihtiyaç varsa: dosyaya dokunma, görev raporunda "X'e şu eklenmeli" yaz.
- `HANDOFF.md` ve `CLAUDE.md` bu sprintte **hiçbir ajan tarafından düzenlenmez**; birleştirmeden sonra kullanıcı tek oturumda güncelletir. Her ajan bunun yerine kendi `docs/REPORT-<harf>.md` dosyasına rapor yazar.
- Birleştirme sırası: **A → B → C**.

## 3. Şema değişiklikleri (tek migration, Ajan A uygular)

```prisma
// ---------- ARENA (Ajan A) ----------
enum EvolutionStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum EvolutionStage {
  GENERATE   // adaylar üretiliyor (tohum veya mutasyon)
  LINT       // deterministik kural kontrolü
  JUDGE      // AI jüri paneli
  SELECT     // skor birleştirme + seçilim
  DONE
}

enum CandidateOrigin {
  SEED
  MUTATION
  CROSSOVER
  ELITE
}

model EvolutionRun {
  id             String          @id @default(cuid())
  brand          Brand           @relation(fields: [brandId], references: [id], onDelete: Cascade)
  brandId        String
  status         EvolutionStatus @default(QUEUED)
  // Kullanıcı girdileri
  goal           String          // "sales" | "traffic" | "leads" | "awareness" (lib/options.ts)
  offer          String?         // kullanıcının GERÇEK teklifi; yoksa hiçbir adayda teklif yok
  instruction    String?
  // Döngü ayarları — kullanıcı seçer, sınırlar kodda (AGENT-A §3)
  config         Json            // { rounds, population, survivors, judges }
  currentRound   Int             @default(0)
  maxRounds      Int
  // Sonuç
  winnerCreativeId String?       // kazanan, Creative tablosuna yazılır (onay akışına girer)
  summary        Json?           // { convergence, winnerRationale, confidence, dataBasis, disclaimer }
  error          String?
  model          String?
  promptTokens   Int?
  outputTokens   Int?
  rounds         EvolutionRound[]
  candidates     EvolutionCandidate[]
  createdAt      DateTime        @default(now())
  finishedAt     DateTime?

  @@index([brandId, createdAt])
}

model EvolutionRound {
  id           String         @id @default(cuid())
  run          EvolutionRun   @relation(fields: [runId], references: [id], onDelete: Cascade)
  runId        String
  index        Int            // 0-tabanlı
  stage        EvolutionStage @default(GENERATE)
  // Açıklanabilirlik: jüriye ne verildi, ne döndü (snapshot)
  judgeInput   Json?
  judgeOutput  Json?
  claimedAt    DateTime?      // yarış koruması (AGENT-A §3)
  promptTokens Int?
  outputTokens Int?
  startedAt    DateTime       @default(now())
  finishedAt   DateTime?
  candidates   EvolutionCandidate[]

  @@unique([runId, index])
}

model EvolutionCandidate {
  id              String          @id @default(cuid())
  run             EvolutionRun    @relation(fields: [runId], references: [id], onDelete: Cascade)
  runId           String
  round           EvolutionRound  @relation(fields: [roundId], references: [id], onDelete: Cascade)
  roundId         String
  parentId        String?         // mutasyon/crossover kaynağı (EvolutionCandidate.id)
  origin          CandidateOrigin
  // Creative ile aynı alan seti (kazanan birebir Creative'e kopyalanır)
  strategy        String
  hook            String
  primaryText     String
  headline        String
  description     String?
  cta             String
  targetNote      String?
  why             String
  // Skorlar
  lintScore       Int             // 0-100, deterministik
  lintIssues      Json            // [{ rule, severity: "hard"|"soft", message }]
  judgeScore      Decimal?        @db.Decimal(5, 2) // 0-100, jüri ortalaması (lint'ten geçenler için)
  judgeBreakdown  Json?           // { [judgeKey]: { scores: {dim: n}, critique, suggestedMutation } }
  totalScore      Decimal?        @db.Decimal(5, 2) // AGENT-A §4 formülü
  rank            Int?
  survived        Boolean         @default(false)
  eliminatedReason String?
  createdAt       DateTime        @default(now())

  @@index([runId, roundId])
}

// ---------- KİT (Ajan B) ----------
model PublishKit {
  id          String       @id @default(cuid())
  plan        CampaignPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  planId      String
  version     Int          @default(1)
  // AGENT-B §4 şeması — deterministik olarak plan + onaylı creative'lerden üretilir
  kit         Json
  // Kullanıcının Ads Manager'da işaretlediği adımlar: { [stepId]: true }
  checklist   Json         @default("{}")
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([planId])
}

// CampaignPlan'a eklenir:
//   publishedAt DateTime?      // kullanıcı "Ads Manager'da yayınladım" dedi
//   publishNote String?        // ör. Ads Manager kampanya adı/ID (kullanıcı elle girer)
//   kits        PublishKit[]

// ---------- MARKA ZENGİNLEŞTİRME (Ajan C) ----------
enum BrandAssetKind {
  LOGO
  PRODUCT_IMAGE
  OTHER
}

model BrandAsset {
  id        String         @id @default(cuid())
  brand     Brand          @relation(fields: [brandId], references: [id], onDelete: Cascade)
  brandId   String
  kind      BrandAssetKind
  name      String
  data      Bytes          // CreativeImage ile aynı karar: DB'de bytea (Vercel'de disk yok)
  mimeType  String
  createdAt DateTime       @default(now())

  @@index([brandId])
}

// Brand'e eklenir:
//   brandVoice  String?   // ton/ses (serbest metin, kısa)
//   usp         String?   // ayrıştırıcı değer önerisi
//   products    Json?     // [{ name, price?: string, url?: string, description?: string }]
//   assets      BrandAsset[]
//   evolutionRuns EvolutionRun[]
```

`lib/options.ts`'e eklenecek sabitler (Ajan A ekler, diğerleri kullanır):

```ts
export const CAMPAIGN_GOALS = ["sales", "traffic", "leads", "awareness"] as const;
export const EVOLUTION_LIMITS = { rounds: { min: 2, max: 8, default: 4 }, population: { min: 4, max: 10, default: 6 }, survivors: { min: 1, max: 3, default: 2 }, judges: { min: 2, max: 4, default: 3 } } as const;
```

## 4. Action / route sözleşmeleri

Her ajan kendi action'larını yazar; **imzalar burada sabittir** ki C wizard'ı A ve B'yi çağırabilsin.

### Ajan A — `src/actions/evolution.ts`

```ts
export type EvolutionFormState = { error?: string; success?: boolean; runId?: string };
// Form alanları: goal, offer?, instruction?, rounds?, population?, survivors?, judges?
export async function startEvolutionRun(brandId: string, _prev: EvolutionFormState, formData: FormData): Promise<EvolutionFormState>;
// Bir tur (veya turun bir aşaması) ilerletir; idempotent; 60 sn altında döner. Poller bunu çağırır.
export async function advanceEvolutionRun(runId: string): Promise<{ status: EvolutionStatus; currentRound: number; stage: EvolutionStage | null }>;
export async function cancelEvolutionRun(formData: FormData): Promise<void>; // runId
// Kazanan + ilk N adayı Creative'e kopyalar (PENDING) — startEvolutionRun tamamlanınca A bunu otomatik da çağırır
export async function promoteCandidates(runId: string, candidateIds: string[]): Promise<{ creativeIds: string[] }>;
```

Sayfa: `/app/brands/[id]/arena` (liste + yeni koşu) ve `/app/brands/[id]/arena/[runId]` (turlar, adaylar, skor dökümü, kazanan).

### Ajan B — `src/actions/publish-kit.ts`

```ts
export type KitFormState = { error?: string; success?: boolean; kitId?: string };
// Plan COMPLETED + en az 1 APPROVED creative şart; aksi halde hata
export async function buildPublishKit(planId: string): Promise<KitFormState>;
export async function toggleKitStep(formData: FormData): Promise<void>;      // kitId, stepId, checked
export async function markPlanPublished(formData: FormData): Promise<void>;  // planId, publishNote?
```

Route'lar: `/app/brands/[id]/campaigns/[planId]/kit` (kit sayfası), `GET /api/publish-kits/[kitId]/export?format=json|html` (auth + tenant korumalı), `GET /api/publish-kits/[kitId]/assets/[creativeImageId]?ratio=1x1|4x5|9x16`.

### Ajan C — `src/actions/brands.ts` (genişletme) ve wizard

```ts
export async function updateBrandProfile(brandId, _prev, formData); // brandVoice, usp, products (JSON string)
export async function uploadBrandAsset(brandId, _prev, formData);   // kind, file (≤2 MB, image/*)
export async function deleteBrandAsset(formData);                   // assetId
```

Sayfa: `/app/brands/[id]/launch` — adım durumlarını okur (DB'den), mevcut action'ları ve A/B'nin action'larını çağırır. Önizleme bileşenleri: `components/preview/*`.

### Çapraz import YASAK

Hiçbir ajan diğerinin `actions/*` veya `lib/*` dosyasını import etmez (branch'inde yok → build kırılır). Birbirine yalnız **DB modelleri** (ortak migration) ve **route URL'leri** üzerinden bağlanır.

### Ortak yardımcı

Tüm action'lar `requireUser()` + `workspace.ownerId` ile marka sahipliğini doğrular (`actions/creatives.ts`'teki `requireOwnedBrand` deseni). Bütün önemli işlemler `audit()` ile loglanır.

## 5. Dosya sahipliği

| Ajan | Sahip olduğu (oluşturur/değiştirir) | DOKUNMAZ |
|---|---|---|
| **A** | `packages/db/prisma/schema.prisma` + yeni migration; `src/lib/options.ts` (yalnız ekleme); `src/lib/evolution/**`; `src/actions/evolution.ts`; `src/components/evolution/**`; `src/app/app/brands/[id]/arena/**`; `docs/REPORT-A.md` | `lib/campaigns`, `lib/creatives` (okur, değiştirmez), `components/brand-form.tsx`, marka sayfası, sidebar |
| **B** | `src/lib/publish-kit/**`; `src/lib/campaigns/prompts.ts` (yalnız kit için gereken alan eklemeleri); `src/actions/publish-kit.ts`; `src/components/campaigns/**`; `src/app/app/brands/[id]/campaigns/**`; `src/app/api/publish-kits/**`; `apps/web/package.json` (yalnız `sharp` ekleme); `docs/META-ADS-MANAGER-FIELDS.md`; `docs/REPORT-B.md` | şema, `lib/evolution`, marka sayfası, sidebar |
| **C** | `src/actions/brands.ts`; `src/components/brand-form.tsx`; `src/components/preview/**`; `src/components/launch/**`; `src/app/app/brands/[id]/page.tsx`; `src/app/app/brands/[id]/launch/**`; `src/app/api/brand-assets/**`; `src/app/app/page.tsx` (dashboard); `src/components/sidebar-nav.tsx`; `src/components/ui.tsx` (yalnız ekleme); `docs/REPORT-C.md` | şema, `lib/evolution`, `lib/publish-kit`, campaigns sayfaları |

Marka sayfasına (`brands/[id]/page.tsx`, C'nin) A ve B'nin linkleri C tarafından eklenir: "Arena →" (`/arena`) ve kampanya planı kartlarındaki "Kurulum kiti →" (`/campaigns/[planId]/kit`). Route adları sabittir; sayfa henüz merge edilmediyse link 404 verir, sorun değil.

## 6. Doğrulama (her ajan, bitirmeden önce)

1. `pnpm lint` temiz.
2. `pnpm build` (type check dahil) temiz.
3. Gerçek Gemini ile dev'de uçtan uca canlı test (A ve C); B için kit üretimi + export + asset boyutlandırma canlı test.
4. Tenant izolasyonu: başka workspace'in kaydına URL ile erişim 404/403 (her yeni route için en az bir kez denenir).
5. `docs/REPORT-<harf>.md`: yapılanlar, test kanıtı, bilinen sınırlar, diğer ajanlara notlar, HANDOFF'a girecek özet.

## 7. Kullanıcının onaylaması gereken varsayılanlar

Aksi söylenmedikçe ajanlar şu varsayılanlarla ilerler:

- Arena varsayılanı 4 tur × 6 aday × 3 jüri (~16 AI çağrısı/koşu); üst sınır 8 × 10 × 4.
- Kazanan + en iyi 2 aday Creative'e PENDING olarak yazılır (kullanıcı onaylar).
- Kit dışa aktarma: JSON + yazdırılabilir HTML. Meta'nın toplu içe aktarma şablonu **yalnız resmi dokümandan doğrulanırsa** eklenir.
- Görsel oranları: 1:1, 4:5, 9:16 (sharp ile yeniden boyutlandırma; kaynak görsel `CreativeImage`).
- Landing sayfası bu sprintte **değişmez** (tüm istekler panel özelliği).
- Instagram/Facebook logosu ve marka adı önizlemelerde kullanılmaz; "Akış / Hikâye / Reels" nötr çerçeveleri.
