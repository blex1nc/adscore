# META SPRINT — ORTAK SÖZLEŞME (3 AJAN)

Tarih: 2026-08-24. Bu dosya A / B / C ajanlarının **tek ortak referansıdır.**
Okuma sırası: `CLAUDE.md` → `HANDOFF.md` (§14, §21.4, §21.5, §23) → `PHASE0-META-VERIFICATION.md` → `docs/meta/ANALIZ.md` → bu dosya → kendi görev dosyan.

## 0. Sprintin amacı

Meta developer hesabı açıldı. Bu sprintte AdScore:

1. Kullanıcının Meta Business hesabını **panelden bağlar** (resmi OAuth), varlıklarını seçtirir (HANDOFF §21.4).
2. Onaylı creative + kampanya planını **gerçek Meta nesnelerine** dönüştürür — **yalnızca PAUSED**.
3. Yayınlanmış kampanyaların **gerçek performans verisini** çeker ve mevcut AdScore/optimizasyon zincirine besler.
4. EU kapsamındaki pazarlarda rakip reklamlarını **Ad Library API**'den otomatik toplar.

PublishKit (elle kurulum kiti) **kaldırılmaz** — bağlantısı/izni olmayan kullanıcı için birincil yol olarak kalır.

## 1. Kırmızı çizgiler (her ajan için)

- **PARA HARCATMA YOK.** Oluşturulan her Meta nesnesi `status: PAUSED`. `ACTIVE`, `budget update`, `bid` değişikliği bu sprintte **yazılmaz** (CLAUDE.md §20, §44). Kod içinde ACTIVE'e set eden tek bir yol bile bulunmayacak.
- **MOCK YOK** (CLAUDE.md §33). Bağlantı/izin/veri yoksa dürüst `BLOCKED` gösterilir. Sahte Meta cevabı üretilmez. (Testlerde sabit fixture kullanılabilir, ürün yolunda asla.)
- **HAFIZADAN META YAZMA** (HANDOFF §23). Her ajan kullandığı **her ucu** güncel resmi dokümandan doğrular ve `docs/meta/SOURCES-<harf>.md` dosyasına `source / url / retrieved_at / used_for` olarak yazar (CLAUDE.md §37). PHASE0 doğrulaması izin seviyesindedir, payload seviyesinde değildir.
- **SAYI UYDURMA YOK** (CLAUDE.md §6, §31). Tahmin yalnız Meta'nın kendi `delivery_estimate` çıktısıdır; Meta güven veremiyorsa ekran "Insufficient Data" der. Kendi CTR/CPC/ROAS tahmin modelimiz yok.
- **Insights verisi mevcut doğrulama yolundan geçer.** Yeni sonuç modeli açılmaz; `CampaignResult` + mevcut metrik/AdScore zinciri kullanılır.
- **Secrets koda girmez.** Token'lar DB'de AES-256-GCM ile şifreli; anahtar `META_TOKEN_KEY` env'de. Log'a token, app secret, tam URL query'si yazılmaz.
- **Deploy ve `git push` YOK.** Birleştirmeyi kullanıcı yapar.
- Vercel 60 sn sınırı: uzun işler adım adım kalıcı + poller (`components/research/research-poller.tsx` deseni).
- Dil: panel TR, kod yorumları TR, hata mesajları TR ve eyleme dönük (CLAUDE.md §42).
- Her Meta yazma işlemi audit log'lanır: kim, ne zaman, hangi nesne, istek/cevap özeti (CLAUDE.md §41).

## 2. Çalışma düzeni

- Branch: `meta/agent-a`, `meta/agent-b`, `meta/agent-c` (worktree önerilir). Ortak dev DB `adscore_dev`.
- Portlar: A `3000`, B `3001`, C `3002`.
- **Şema tek elden:** Bölüm 3'ün tamamını (B ve C'nin alanları dahil) **yalnız Ajan A** uygular, **t=0'da**, tek migration: `meta_connection_publish_insights`. Commit sonrası B/C cherry-pick eder.
- **İstemci sözleşmesi t=0'da sabittir** (Bölüm 4). A gerçek implementasyonu yazana kadar B ve C bu imzaya karşı kendi test stub'larıyla ilerler. **İmza değişirse A, B ve C'ye rapor dosyasından haber verir; sessiz değişiklik yasak.**
- Migration sonrası dev server yeniden başlatılır (Prisma client bellekte eskiyor).
- Dosya sahipliği (Bölüm 5) kesindir. Başkasının dosyası gerekiyorsa dokunma; `docs/meta/REPORT-<harf>.md`'ye "X dosyasına şu eklenmeli" yaz.
- `CLAUDE.md`, `HANDOFF.md` bu sprintte düzenlenmez.
- Birleştirme sırası: **A → B → C**.

## 3. Şema değişiklikleri (tek migration, Ajan A uygular)

```prisma
// ---------- BAĞLANTI (Ajan A) ----------
enum MetaConnectionStatus {
  CONNECTED
  EXPIRED       // token süresi doldu, yeniden bağlanmalı
  REVOKED       // kullanıcı Meta tarafından izni kaldırdı (deauthorize webhook)
  DISCONNECTED  // panelden koparıldı
}

model MetaConnection {
  id           String   @id @default(cuid())
  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  workspaceId  String   @unique          // MVP: workspace başına tek bağlantı
  metaUserId   String                     // Meta app-scoped user id
  // AES-256-GCM: şifreli token + iv + auth tag. Düz token HİÇBİR YERDE saklanmaz.
  tokenCipher  Bytes
  tokenIv      Bytes
  tokenTag     Bytes
  tokenExpires DateTime?
  scopes       String[]                   // debug_token'dan gelen GERÇEK izinler
  status       MetaConnectionStatus @default(CONNECTED)
  lastCheckedAt DateTime?
  errorNote    String?                    // son doğrulama hatası (TR)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  adAccounts   MetaAdAccount[]
  bindings     BrandMetaBinding[]
}

// Kullanıcının erişebildiği ad account'ların önbelleği (seçim ekranı için).
model MetaAdAccount {
  id            String   @id @default(cuid())
  connection    MetaConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  connectionId  String
  actId         String   // "act_123..."
  name          String
  currency      String
  timezoneName  String?
  accountStatus Int?     // Meta'nın sayısal durum kodu (ham saklanır, yorum UI'da)
  fetchedAt     DateTime @default(now())

  @@unique([connectionId, actId])
}

// Marka ↔ Meta varlık eşlemesi. Page ID yayın için ZORUNLU (object_story_spec).
model BrandMetaBinding {
  id                String   @id @default(cuid())
  brand             Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  brandId           String   @unique
  connection        MetaConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  connectionId      String
  adAccountId       String   // "act_..."
  adAccountCurrency String
  pageId            String
  instagramActorId  String?
  pixelId           String?
  catalogId         String?  // bu sprintte kullanılmaz, alan hazır
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

// Her Meta API çağrısının sayacı (CLAUDE.md §43 maliyet takibi + rate limit teşhisi).
model MetaApiCall {
  id          String   @id @default(cuid())
  workspaceId String
  brandId     String?
  method      String   // GET | POST
  path        String   // token/param YOK — yalnız uç yolu
  httpStatus  Int?
  errorCode   Int?
  errorSub    Int?
  fbtraceId   String?
  durationMs  Int
  appUsagePct Int?     // X-App-Usage / X-Ad-Account-Usage'dan
  createdAt   DateTime @default(now())

  @@index([workspaceId, createdAt])
}

// ---------- YAYIN (Ajan B) ----------
enum MetaPublishStatus {
  DRAFT       // hazırlandı, gönderilmedi
  RUNNING
  COMPLETED   // Meta'da PAUSED olarak oluşturuldu
  FAILED
}

model MetaPublish {
  id             String   @id @default(cuid())
  plan           CampaignPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  planId         String
  brandId        String
  status         MetaPublishStatus @default(DRAFT)
  // Aşama aşama ilerler (Vercel 60 sn): campaign → adset → ad → creative
  stage          String   @default("CAMPAIGN")
  claimedAt      DateTime?      // yarış koruması (Arena'daki desenin aynısı)
  metaCampaignId String?
  metaAdSetId    String?
  metaCreativeId String?
  metaAdId       String?
  // Gönderilen payload + dönen cevap: açıklanabilirlik (CLAUDE.md §29/§41).
  request        Json?
  response       Json?
  // Meta'ya gönderilen efektif durum. Bu sprintte HER ZAMAN "PAUSED".
  effectiveStatus String  @default("PAUSED")
  error          String?
  createdAt      DateTime @default(now())
  finishedAt     DateTime?

  @@index([planId, createdAt])
}

// Kampanya planına Meta izleri (Ajan B doldurur, Ajan C okur).
// model CampaignPlan { ... EKLE:
//   metaCampaignId      String?
//   metaAdSetId         String?
//   metaAdId            String?
//   metaPublishedAt     DateTime?
//   // Aramadan dönen GERÇEK Meta hedefleme nesneleri (uydurma ID yok, CLAUDE.md §6)
//   metaTargeting       Json?
//   // Özel reklam kategorisi — kullanıcı seçer, varsayılan yok (yanlışı Meta reddi demek)
//   specialAdCategories String[]
//   publishes           MetaPublish[]
// }

// model Workspace { ... EKLE:
//   // Harcama tavanı (CLAUDE.md §23). Kullanıcı belirler; guards bunu zorlar.
//   maxDailyBudget Decimal? @db.Decimal(12, 2)
//   metaConnection MetaConnection?
// }

// ---------- VERİ (Ajan C) ----------
enum ResultSource {
  MANUAL
  CSV
  META_API
}

model MetaInsightSync {
  id          String   @id @default(cuid())
  brand       Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  brandId     String
  planId      String?
  adAccountId String
  since       DateTime
  until       DateTime
  status      AnalysisStatus @default(QUEUED)
  rowCount    Int?
  // Ham Meta cevabı: sayılar koddan türetilir, AI'a ham veri gitmez.
  raw         Json?
  error       String?
  createdAt   DateTime @default(now())
  finishedAt  DateTime?

  @@index([brandId, createdAt])
}

// model CampaignResult { ... EKLE:
//   source        ResultSource @default(MANUAL)
//   externalRef   String?      // Meta campaign/adset id — tekrar yazımı engeller
//   @@unique([planId, periodStart, periodEnd, source])  ← idempotent senkron
// }

// model CompetitorAd { ... EKLE:
//   adArchiveId   String?      // Ad Library kaydı
//   fromAdLibrary Boolean @default(false)
//   libraryMeta   Json?        // yayın tarihleri, platformlar, kapsam notu
// }

// model Brand { ... EKLE:
//   metaBinding   BrandMetaBinding?
//   insightSyncs  MetaInsightSync[]
// }
```

## 4. `MetaClient` sözleşmesi (t=0'da sabit — Ajan A yazar, B ve C tüketir)

`apps/web/src/lib/meta/client.ts`

```ts
export type MetaCallOptions = {
  brandId?: string;          // maliyet kaydı + ad account bağlamı
  timeoutMs?: number;        // varsayılan 20_000
  idempotencyKey?: string;   // yazma çağrılarında tekrarı engellemek için
};

export interface MetaClient {
  get<T>(path: string, params?: Record<string, string | number>, opts?: MetaCallOptions): Promise<T>;
  post<T>(path: string, body: Record<string, unknown>, opts?: MetaCallOptions): Promise<T>;
  /** Sayfalama: Meta'nın paging.next zinciri; hard limit çağıranda. */
  paginate<T>(path: string, params?: Record<string, string | number>, opts?: MetaCallOptions & { maxPages?: number }): Promise<T[]>;
}

/** Workspace'in bağlantısını çözer, token'ı deşifre eder, istemciyi kurar.
 *  Bağlantı yok / EXPIRED / REVOKED ise MetaBlockedError fırlatır. */
export function metaClientForWorkspace(workspaceId: string): Promise<MetaClient>;

/** Markanın bağlı varlıkları; eksikse MetaBlockedError (hangi varlık eksik yazar). */
export function requireBrandBinding(brandId: string): Promise<{
  client: MetaClient;
  adAccountId: string;   // "act_..."
  pageId: string;
  instagramActorId: string | null;
  pixelId: string | null;
  currency: string;
}>;

export class MetaApiError extends Error {
  code: number; subcode: number | null; type: string | null; fbtraceId: string | null;
  httpStatus: number;
  isRateLimit: boolean; isPermission: boolean; isTransient: boolean;
  /** Kullanıcıya gösterilecek TR mesaj + önerilen aksiyon (CLAUDE.md §42). */
  userMessage: string;
}

/** Bağlantı/izin/varlık eksikliği — hata değil, dürüst kapı. UI "BLOCKED" gösterir. */
export class MetaBlockedError extends Error {
  reason: "NO_CONNECTION" | "TOKEN_EXPIRED" | "REVOKED" | "NO_BINDING" | "MISSING_PERMISSION" | "NO_APP_CREDENTIALS";
  missing?: string[];      // eksik izin/varlık adları
  userMessage: string;     // TR
}
```

```ts
// lib/meta/guards.ts — para harcatma kilidi (Ajan A yazar, Ajan B zorunlu çağırır)
export function assertSafePayload(input: {
  kind: "create" | "update";              // update = mevcut Meta nesne ID'sine giden her çağrı
  payload: Record<string, unknown>;
  plan?: { budgetAmount: string; currency: string };
  maxDailyBudget?: string | null;
}): void;
// create: status === "PAUSED" ZORUNLU; bütçe alanı varsa = plan.budgetAmount ve <= maxDailyBudget.
// update: status / daily_budget / lifetime_budget / bid_amount alanları TÜMÜYLE YASAK.
// her iki durumda status "ACTIVE" mutlak yasak.
export function assertPublishAllowed(input: { brandId: string; userId: string }): Promise<void>;
```

**Kurallar:**
- B ve C **doğrudan `fetch` ile Meta'ya çağrı yapmaz.** Yalnız bu istemci üzerinden.
- API sürümü tek yerde sabittir (`META_API_VERSION`); ajanlar kendi dosyalarında sürüm yazmaz.
- Rate limit / retry / maliyet kaydı / audit istemcinin içindedir; B ve C tekrar yazmaz.
- `MetaBlockedError` yakalanır ve UI'da **dürüst kapı** olarak gösterilir; sessizce boş sonuç dönmez.

## 5. Dosya sahipliği (kesin)

| Ajan | Sahip olduğu yollar |
|---|---|
| **A** | `packages/db/prisma/**`, `apps/web/src/lib/meta/**`, `apps/web/src/actions/meta.ts`, `apps/web/src/app/api/meta/**` (oauth callback + webhooks), `apps/web/src/app/app/settings/meta/**`, `apps/web/src/components/meta/**`, `.env.example`, `docs/meta/SOURCES-A.md`, `docs/meta/REPORT-A.md` |
| **B** | `apps/web/src/lib/meta-publish/**`, `apps/web/src/actions/meta-publish.ts`, `apps/web/src/app/app/brands/[id]/campaigns/[planId]/publish/**`, `apps/web/src/components/publish/**`, `docs/META-ADS-MANAGER-FIELDS.md`, `docs/meta/SOURCES-B.md`, `docs/meta/REPORT-B.md` |
| **C** | `apps/web/src/lib/meta-insights/**`, `apps/web/src/lib/meta-library/**`, `apps/web/src/actions/meta-insights.ts`, `apps/web/src/actions/meta-library.ts`, `apps/web/src/components/insights/**`, `apps/web/src/components/library/**`, `docs/meta/SOURCES-C.md`, `docs/meta/REPORT-C.md` |

Ortak dosyalar (`lib/options.ts`, mevcut sayfa dosyaları, sidebar): **yalnız link/sabit ekleme** düzeyinde, tek satırlık değişiklikle ve rapora yazarak. Çakışma riski olan mevcut sayfaya (ör. `campaigns/[planId]/page.tsx`) yalnız **B** dokunur; A ve C link ihtiyacını rapora yazar.

## 6. Ortak "bitti" tanımı (her ajan için)

Bir iş şu 6 madde tamamsa bitmiştir:

1. `pnpm build` (veya `tsc --noEmit`) temiz; lint temiz.
2. Saf mantık için birim testi var (istemci hata haritası, payload üreticisi, insights → CampaignResult dönüşümü).
3. **Gerçek Meta çağrısıyla** en az bir uçtan uca kanıt (test ad account) — rapora ekran/çıktı özeti + tarih.
4. Kullanılan her uç `docs/meta/SOURCES-<harf>.md`'de kaynak + retrieved_at ile kayıtlı.
5. Bağlantısız / izinsiz durumda dürüst BLOCKED gösterildiği doğrulandı.
6. `docs/meta/REPORT-<harf>.md` güncel: yapılanlar, testler, açık kalanlar, diğer ajanlara notlar.

## 7. Sprint boyunca değişmeyecek kabuller

- Erişim seviyesi Limited Access; yalnız app'te rolü olan kullanıcı test eder (PHASE0 §1.1).
- App Review / Business Verification bu sprintin kapsamında değil (açık soru F1).
- PublishKit ve CSV yolu korunur; Meta yolu bunların **alternatifi**, yerine geçeni değil.
- Arena, araştırma, optimizasyon, öğrenme motorlarının iç mantığına dokunulmaz.
