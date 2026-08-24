import "server-only";

// A1 — Uygulama kimlik bilgileri kapısı.
// Eksikse çalışmayan buton yok: UI dürüst BLOCKED gösterir (CLAUDE.md §33).

export type MetaCredentialStatus = {
  ok: boolean;
  missing: string[]; // eksik env değişken adları (değer asla değil)
};

/** Hangi Meta env değişkenleri eksik? Değer okunmaz, yalnız varlık kontrol edilir. */
export function metaCredentialStatus(): MetaCredentialStatus {
  const missing: string[] = [];
  if (!process.env.META_APP_ID) missing.push("META_APP_ID");
  if (!process.env.META_APP_SECRET) missing.push("META_APP_SECRET");
  if (!process.env.META_TOKEN_KEY) missing.push("META_TOKEN_KEY");
  return { ok: missing.length === 0, missing };
}

/** App ID + secret; eksikse throw etmez, null döner — çağıran BLOCKED kararını verir. */
export function getMetaAppCredentials(): {
  appId: string;
  appSecret: string;
} | null {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

/** META_TOKEN_KEY: base64, tam 32 bayt (AES-256-GCM anahtarı). Hatalıysa null. */
export function getTokenKey(): Buffer | null {
  const raw = process.env.META_TOKEN_KEY;
  if (!raw) return null;
  try {
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) return null;
    return key;
  } catch {
    return null;
  }
}

/** Facebook Login for Business config ID (App Dashboard'da oluşturulur; opsiyonel).
 *  Varsa OAuth dialog'a config_id gider, yoksa klasik scope listesi. SOURCES-A #2/#4. */
export function getLoginConfigId(): string | null {
  return process.env.META_LOGIN_CONFIG_ID || null;
}

/** Webhook doğrulama token'ı (kullanıcı belirler, App Dashboard'a da aynısı girilir). */
export function getWebhookVerifyToken(): string | null {
  return process.env.META_WEBHOOK_VERIFY_TOKEN || null;
}
