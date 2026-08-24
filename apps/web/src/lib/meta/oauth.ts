import "server-only";

// A2 — OAuth akışı yardımcıları. Tüm uçlar SOURCES-A.md'de kaynaklı (retrieved 2026-08-24).
// Dialog: https://www.facebook.com/{v}/dialog/oauth  (SOURCES-A #3, #4)
// Kod değişimi + uzun ömürlü değişim: GET /{v}/oauth/access_token  (SOURCES-A #3, #5)
// Gerçek izinler: GET /debug_token  (SOURCES-A #6)
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { META_API_VERSION } from "./client";

export const META_OAUTH_STATE_COOKIE = "meta_oauth_state";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 dk

// PHASE0 §1.3 MVP izin seti (App Review'sız, app'te rolü olan kullanıcı için çalışır)
export const REQUIRED_SCOPES = [
  "ads_management",
  "ads_read",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
] as const;

// ---- state (CSRF): "nonce.exp.imza" — imza = HMAC-SHA256(nonce.exp, appSecret) ----

export function createOauthState(appSecret: string): string {
  const nonce = randomBytes(16).toString("base64url");
  const exp = Date.now() + STATE_TTL_MS;
  const sig = createHmac("sha256", appSecret)
    .update(`${nonce}.${exp}`)
    .digest("base64url");
  return `${nonce}.${exp}.${sig}`;
}

/** İmza + süre kontrolü. Cookie eşleşmesi çağıranda (route) yapılır. */
export function verifyOauthState(state: string, appSecret: string): boolean {
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac("sha256", appSecret)
    .update(`${nonce}.${exp}`)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---- dialog URL ----

export function buildAuthUrl(input: {
  appId: string;
  redirectUri: string;
  state: string;
  configId: string | null; // varsa config_id (Login for Business), yoksa scope
}): string {
  const u = new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`);
  u.searchParams.set("client_id", input.appId);
  u.searchParams.set("redirect_uri", input.redirectUri);
  u.searchParams.set("state", input.state);
  u.searchParams.set("response_type", "code");
  if (input.configId) {
    u.searchParams.set("config_id", input.configId);
  } else {
    u.searchParams.set("scope", REQUIRED_SCOPES.join(","));
  }
  return u.toString();
}

// ---- Graph çağrıları (OAuth aşaması: henüz MetaConnection yok, istemci kurulamaz;
//      bu üç çağrı burada tek fetch yardımıcısıyla yapılır ve loglanmaz — URL'de secret var) ----

const GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

async function oauthGet<T>(url: URL): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = (await res.json().catch(() => null)) as
    | (T & { error?: { message?: string; code?: number } })
    | null;
  if (!res.ok || !body || body.error) {
    // Dikkat: URL query'si (secret/kod) asla hata mesajına yazılmaz (CONTRACTS §1).
    const code = body?.error?.code;
    throw new Error(
      `Meta OAuth çağrısı başarısız (HTTP ${res.status}${code ? `, kod ${code}` : ""}).`,
    );
  }
  return body as T;
}

/** Authorization code → kısa ömürlü user token (SOURCES-A #3). */
export async function exchangeCode(input: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ access_token: string; expires_in?: number }> {
  const u = new URL(`${GRAPH}/oauth/access_token`);
  u.searchParams.set("client_id", input.appId);
  u.searchParams.set("redirect_uri", input.redirectUri);
  u.searchParams.set("client_secret", input.appSecret);
  u.searchParams.set("code", input.code);
  return oauthGet(u);
}

/** Kısa ömürlü → uzun ömürlü (~60 gün) user token (SOURCES-A #5). */
export async function exchangeLongLived(input: {
  appId: string;
  appSecret: string;
  shortLivedToken: string;
}): Promise<{ access_token: string; expires_in?: number }> {
  const u = new URL(`${GRAPH}/oauth/access_token`);
  u.searchParams.set("grant_type", "fb_exchange_token");
  u.searchParams.set("client_id", input.appId);
  u.searchParams.set("client_secret", input.appSecret);
  u.searchParams.set("fb_exchange_token", input.shortLivedToken);
  return oauthGet(u);
}

export type DebugTokenData = {
  app_id?: string;
  user_id?: string;
  is_valid?: boolean;
  expires_at?: number; // unix saniye; 0 = süresiz
  data_access_expires_at?: number;
  scopes?: string[];
  granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
};

/** Verilen GERÇEK izin listesi debug_token'dan okunur — izin ekranında kaldırılan
 *  izinler burada görünür (SOURCES-A #6). access_token olarak app token kullanılır. */
export async function debugToken(input: {
  appId: string;
  appSecret: string;
  inputToken: string;
}): Promise<DebugTokenData> {
  const u = new URL(`https://graph.facebook.com/debug_token`);
  u.searchParams.set("input_token", input.inputToken);
  // App token: "APP_ID|APP_SECRET" biçimi (client_credentials'a gerek bırakmaz)
  u.searchParams.set("access_token", `${input.appId}|${input.appSecret}`);
  const body = await oauthGet<{ data: DebugTokenData }>(u);
  return body.data ?? {};
}

/** Verilen izinlerle zorunlu set arasındaki fark — isim isim (A2 gereği). */
export function missingScopes(granted: string[]): string[] {
  const set = new Set(granted);
  return REQUIRED_SCOPES.filter((s) => !set.has(s));
}
