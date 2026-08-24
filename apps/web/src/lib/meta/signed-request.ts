// A6 — Meta signed_request ayrıştırma + imza doğrulama.
// Format (SOURCES-A #14): "imza.payload", ikisi de base64url;
// imza = HMAC-SHA256(payload-string, app_secret). Payload JSON: algorithm, user_id, issued_at.
// Saf fonksiyon — secret parametre olarak gelir (birim test edilebilir).
import { createHmac, timingSafeEqual } from "node:crypto";

export type SignedRequestPayload = {
  algorithm?: string;
  user_id?: string;
  issued_at?: number;
  [k: string]: unknown;
};

/** Geçersiz imza/format → null. Asla throw etmez (webhook ucu 200 dönebilsin diye). */
export function parseSignedRequest(
  signedRequest: string,
  appSecret: string,
): SignedRequestPayload | null {
  const dot = signedRequest.indexOf(".");
  if (dot <= 0) return null;
  const encodedSig = signedRequest.slice(0, dot);
  const encodedPayload = signedRequest.slice(dot + 1);
  let sig: Buffer;
  let payloadRaw: Buffer;
  try {
    sig = Buffer.from(encodedSig, "base64url");
    payloadRaw = Buffer.from(encodedPayload, "base64url");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(payloadRaw.toString("utf8"));
    if (
      typeof payload.algorithm === "string" &&
      payload.algorithm.toUpperCase() !== "HMAC-SHA256"
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
