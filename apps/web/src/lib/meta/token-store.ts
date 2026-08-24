import "server-only";

// A3 — Token deposu. getAccessToken YALNIZ lib/meta içinden çağrılır;
// düz token bu modülün dışına sızmaz (CONTRACTS §1, AGENT-A A3).
import { prisma } from "@adscore/db";
import { MetaBlockedError } from "./client";
import { decryptToken, encryptToken } from "./crypto";
import { getMetaAppCredentials, getTokenKey } from "./env";
import { debugToken } from "./oauth";

// lastCheckedAt bundan eskiyse debug_token ile yeniden doğrulanır
const RECHECK_AFTER_MS = 12 * 60 * 60 * 1000; // 12 saat

export function blockedForStatus(status: string): MetaBlockedError {
  if (status === "EXPIRED") {
    return new MetaBlockedError({
      reason: "TOKEN_EXPIRED",
      userMessage:
        "Meta oturumunun süresi doldu. Ayarlar → Meta bağlantısı ekranından yeniden bağlan.",
    });
  }
  if (status === "REVOKED") {
    return new MetaBlockedError({
      reason: "REVOKED",
      userMessage:
        "Meta tarafında uygulamanın izni kaldırılmış. Ayarlar → Meta bağlantısı ekranından yeniden bağlan.",
    });
  }
  return new MetaBlockedError({
    reason: "NO_CONNECTION",
    userMessage:
      "Bu workspace'e bağlı bir Meta hesabı yok. Ayarlar → Meta bağlantısı ekranından bağlan.",
  });
}

/** Workspace'in CONNECTED bağlantısını getirir; yoksa/bozuksa MetaBlockedError. */
export async function requireConnection(workspaceId: string) {
  const conn = await prisma.metaConnection.findUnique({
    where: { workspaceId },
  });
  if (!conn || conn.status === "DISCONNECTED") {
    throw blockedForStatus("NONE");
  }
  if (conn.status !== "CONNECTED") throw blockedForStatus(conn.status);
  return conn;
}

/** Düz token — YALNIZ lib/meta içinden. Süre eskimişse debug_token ile doğrular;
 *  geçersizse status=EXPIRED yazar ve MetaBlockedError fırlatır. */
export async function getAccessToken(workspaceId: string): Promise<string> {
  const conn = await requireConnection(workspaceId);
  const key = getTokenKey();
  if (!key) {
    throw new MetaBlockedError({
      reason: "NO_APP_CREDENTIALS",
      missing: ["META_TOKEN_KEY"],
      userMessage:
        "META_TOKEN_KEY eksik veya hatalı (base64, 32 bayt olmalı). .env.local dosyasını kontrol et.",
    });
  }
  const token = decryptToken(
    {
      cipher: Buffer.from(conn.tokenCipher),
      iv: Buffer.from(conn.tokenIv),
      tag: Buffer.from(conn.tokenTag),
    },
    key,
  );

  // Yerel süre bilgisi geçmişse doğrudan EXPIRED
  if (conn.tokenExpires && conn.tokenExpires.getTime() < Date.now()) {
    await markExpired(conn.id, "Token süresi doldu (yerel kayıt).");
    throw blockedForStatus("EXPIRED");
  }

  // Periyodik gerçek doğrulama: debug_token (SOURCES-A #6)
  const stale =
    !conn.lastCheckedAt ||
    Date.now() - conn.lastCheckedAt.getTime() > RECHECK_AFTER_MS;
  if (stale) {
    const creds = getMetaAppCredentials();
    if (creds) {
      try {
        const data = await debugToken({ ...creds, inputToken: token });
        if (data.is_valid === false) {
          await markExpired(conn.id, "Meta debug_token: token geçersiz.");
          throw blockedForStatus("EXPIRED");
        }
        await prisma.metaConnection.update({
          where: { id: conn.id },
          data: {
            lastCheckedAt: new Date(),
            scopes: data.scopes ?? conn.scopes,
            tokenExpires:
              data.expires_at && data.expires_at > 0
                ? new Date(data.expires_at * 1000)
                : conn.tokenExpires,
            errorNote: null,
          },
        });
      } catch (e) {
        if (e instanceof MetaBlockedError) throw e;
        // debug_token'a ulaşılamadıysa (ağ vb.) bağlantıyı bozmayız; mevcut token'la devam.
      }
    }
  }
  return token;
}

/** OAuth callback'ten gelen token'ı şifreleyip kaydeder (upsert: workspace başına tek bağlantı). */
export async function saveConnection(input: {
  workspaceId: string;
  metaUserId: string;
  accessToken: string;
  expiresAt: Date | null;
  scopes: string[];
}) {
  const key = getTokenKey();
  if (!key) {
    throw new MetaBlockedError({
      reason: "NO_APP_CREDENTIALS",
      missing: ["META_TOKEN_KEY"],
      userMessage:
        "META_TOKEN_KEY eksik veya hatalı (base64, 32 bayt olmalı). .env.local dosyasını kontrol et.",
    });
  }
  const enc = encryptToken(input.accessToken, key);
  const data = {
    metaUserId: input.metaUserId,
    // Prisma Bytes: Uint8Array<ArrayBuffer> bekler — Buffer kopyalanır
    tokenCipher: Uint8Array.from(enc.cipher),
    tokenIv: Uint8Array.from(enc.iv),
    tokenTag: Uint8Array.from(enc.tag),
    tokenExpires: input.expiresAt,
    scopes: input.scopes,
    status: "CONNECTED" as const,
    lastCheckedAt: new Date(),
    errorNote: null,
  };
  return prisma.metaConnection.upsert({
    where: { workspaceId: input.workspaceId },
    create: { workspaceId: input.workspaceId, ...data },
    update: data,
  });
}

export async function markExpired(connectionId: string, note: string) {
  await prisma.metaConnection.update({
    where: { id: connectionId },
    data: { status: "EXPIRED", errorNote: note, lastCheckedAt: new Date() },
  });
}

/** Deauthorize sinyali (A6): metaUserId ile bulur, REVOKED işaretler. */
export async function markRevokedByMetaUserId(metaUserId: string) {
  const conns = await prisma.metaConnection.findMany({ where: { metaUserId } });
  for (const c of conns) {
    await prisma.metaConnection.update({
      where: { id: c.id },
      data: {
        status: "REVOKED",
        errorNote:
          "Kullanıcı, uygulamanın erişimini Meta tarafından kaldırdı (deauthorize).",
      },
    });
  }
  return conns;
}
