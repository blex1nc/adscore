import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptToken, encryptToken } from "../crypto";

const key = randomBytes(32);

test("şifrele → çöz round-trip aynı token'ı verir", () => {
  const token = "EAAG-ornek-token-" + "x".repeat(180);
  const enc = encryptToken(token, key);
  assert.equal(decryptToken(enc, key), token);
});

test("şifreli çıktıda düz token geçmez", () => {
  const token = "EAAG-gizli-token-123456";
  const enc = encryptToken(token, key);
  assert.ok(!enc.cipher.toString("latin1").includes(token));
  assert.ok(!enc.cipher.toString("base64").includes(token));
});

test("cipher üzerinde oynanırsa çözme reddedilir (GCM auth)", () => {
  const enc = encryptToken("token", key);
  enc.cipher[0] = enc.cipher[0] ^ 0xff;
  assert.throws(() => decryptToken(enc, key));
});

test("auth tag üzerinde oynanırsa çözme reddedilir", () => {
  const enc = encryptToken("token", key);
  enc.tag[0] = enc.tag[0] ^ 0xff;
  assert.throws(() => decryptToken(enc, key));
});

test("yanlış anahtarla çözülemez", () => {
  const enc = encryptToken("token", key);
  assert.throws(() => decryptToken(enc, randomBytes(32)));
});

test("32 bayt olmayan anahtar reddedilir", () => {
  assert.throws(() => encryptToken("token", randomBytes(16)));
});
