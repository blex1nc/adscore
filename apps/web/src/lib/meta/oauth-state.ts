// A2 — OAuth state (CSRF) üretimi/doğrulaması. SAF FONKSİYON: server-only yok,
// env yok (node --test ile test edilir). Biçim: "nonce.exp.imza";
// imza = HMAC-SHA256(`${nonce}.${exp}`, appSecret) base64url.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 dk

export function createOauthState(appSecret: string, now = Date.now()): string {
  const nonce = randomBytes(16).toString("base64url");
  const exp = now + STATE_TTL_MS;
  const sig = createHmac("sha256", appSecret)
    .update(`${nonce}.${exp}`)
    .digest("base64url");
  return `${nonce}.${exp}.${sig}`;
}

/** İmza + süre kontrolü. Cookie eşleşmesi çağıranda (route) yapılır. */
export function verifyOauthState(
  state: string,
  appSecret: string,
  now = Date.now(),
): boolean {
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return false;
  const expected = createHmac("sha256", appSecret)
    .update(`${nonce}.${exp}`)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
