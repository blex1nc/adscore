// A3 — Token deposu şifrelemesi: AES-256-GCM (node:crypto).
// Düz token DB'ye/loga/hata mesajına HİÇ girmez (CONTRACTS §1).
// NOT: Bu dosya saf kriptografi — anahtar parametre olarak gelir, env okumaz
// (birim test edilebilir; "server-only" importu env.ts/token-store.ts katmanında).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedToken = {
  cipher: Buffer;
  iv: Buffer;
  tag: Buffer;
};

export function encryptToken(plain: string, key: Buffer): EncryptedToken {
  if (key.length !== 32) throw new Error("Şifreleme anahtarı 32 bayt olmalı");
  const iv = randomBytes(12); // GCM için standart 96-bit IV
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { cipher: enc, iv, tag: cipher.getAuthTag() };
}

export function decryptToken(input: EncryptedToken, key: Buffer): string {
  if (key.length !== 32) throw new Error("Şifreleme anahtarı 32 bayt olmalı");
  const decipher = createDecipheriv("aes-256-gcm", key, input.iv);
  decipher.setAuthTag(input.tag);
  const dec = Buffer.concat([decipher.update(input.cipher), decipher.final()]);
  return dec.toString("utf8");
}
