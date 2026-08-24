import "server-only";

// A7 — HARCAMA GÜVENLİĞİ KİLİDİ (CONTRACTS §4; Ajan B her Meta yazımından önce çağırır).
// Para harcatmayı kod seviyesinde imkânsız kılar (CLAUDE.md §20/§23/§44).
// Saf mantık guards-core.ts'te (birim test edilir); bu dosya DB'ye bakan kapıyı ekler.
import { prisma } from "@adscore/db";
import { MetaBlockedError } from "./client";
import { assertSafePayloadCore, type SafePayloadInput } from "./guards-core";

export type { SafePayloadInput };

/**
 * create: status === "PAUSED" ZORUNLU; bütçe alanı varsa = plan.budgetAmount
 *         ve <= maxDailyBudget (tavan ayarlı değilse yayın reddedilir).
 * update: status / daily_budget / lifetime_budget / bid_amount alanları
 *         TÜMÜYLE YASAK.
 * Her iki durumda status "ACTIVE" mutlak yasak (iç içe alanlar dahil).
 */
export function assertSafePayload(input: SafePayloadInput): void {
  assertSafePayloadCore(input);
}

// Yayın için asgari izin seti (PHASE0 §1.3: ads_management bağımlılıklarıyla)
const PUBLISH_SCOPES = [
  "ads_management",
  "pages_show_list",
  "pages_read_engagement",
] as const;

/** Bağlantı + binding + izin + bütçe tavanı + sahiplik — tek kapıda.
 *  Plan seviyesindeki kullanıcı onayı (onaylı creative + COMPLETED plan)
 *  B'nin yayın akışında ayrıca doğrulanır; bu kapı workspace önkoşullarını zorlar. */
export async function assertPublishAllowed(input: {
  brandId: string;
  userId: string;
}): Promise<void> {
  const brand = await prisma.brand.findUnique({
    where: { id: input.brandId },
    select: {
      metaBinding: true,
      workspace: {
        select: {
          ownerId: true,
          maxDailyBudget: true,
          metaConnection: { select: { status: true, scopes: true } },
        },
      },
    },
  });
  if (!brand || brand.workspace.ownerId !== input.userId) {
    // Sahiplik hatası "blocked" değil, yetki hatasıdır — varlık sızdırılmaz.
    throw new Error("Bu işlem için yetkin yok.");
  }

  const conn = brand.workspace.metaConnection;
  if (!conn || conn.status === "DISCONNECTED") {
    throw new MetaBlockedError({
      reason: "NO_CONNECTION",
      userMessage:
        "Meta hesabı bağlı değil. Ayarlar → Meta bağlantısı ekranından bağlan.",
    });
  }
  if (conn.status === "EXPIRED") {
    throw new MetaBlockedError({
      reason: "TOKEN_EXPIRED",
      userMessage:
        "Meta oturumunun süresi dolmuş. Ayarlar → Meta bağlantısı ekranından yeniden bağlan.",
    });
  }
  if (conn.status === "REVOKED") {
    throw new MetaBlockedError({
      reason: "REVOKED",
      userMessage:
        "Meta tarafında uygulamanın izni kaldırılmış. Ayarlar → Meta bağlantısı ekranından yeniden bağlan.",
    });
  }

  const missingScopes = PUBLISH_SCOPES.filter((s) => !conn.scopes.includes(s));
  if (missingScopes.length > 0) {
    throw new MetaBlockedError({
      reason: "MISSING_PERMISSION",
      missing: missingScopes,
      userMessage: `Yayın için gereken Meta izinleri eksik: ${missingScopes.join(
        ", ",
      )}. Ayarlar → Meta bağlantısı ekranından yeniden bağlanıp bu izinleri onayla.`,
    });
  }

  const binding = brand.metaBinding;
  const missingAssets: string[] = [];
  if (!binding?.adAccountId) missingAssets.push("ad account");
  if (!binding?.pageId) missingAssets.push("Facebook Page");
  if (missingAssets.length > 0) {
    throw new MetaBlockedError({
      reason: "NO_BINDING",
      missing: missingAssets,
      userMessage: `Bu marka için Meta varlıkları eksik: ${missingAssets.join(
        ", ",
      )}. Yayın hattı Page olmadan çalışmaz — Ayarlar → Meta bağlantısı ekranından seç.`,
    });
  }

  if (brand.workspace.maxDailyBudget == null) {
    // CLAUDE.md §23 — limiti kullanıcı koyar; tavan yokken bütçeli nesne yayınlanamaz.
    throw new MetaBlockedError({
      reason: "MISSING_PERMISSION",
      missing: ["maxDailyBudget"],
      userMessage:
        "Workspace için günlük bütçe tavanı ayarlanmamış. Ayarlar → Meta bağlantısı ekranından tavanı belirle; yayın bu güvenlik kilidi olmadan açılmaz.",
    });
  }
}
