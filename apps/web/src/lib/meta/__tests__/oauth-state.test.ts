import { test } from "node:test";
import assert from "node:assert/strict";
import { createOauthState, verifyOauthState } from "../oauth-state";

const secret = "test-app-secret";

test("üretilen state doğrulanır", () => {
  const s = createOauthState(secret);
  assert.equal(verifyOauthState(s, secret), true);
});

test("başka secret ile doğrulanmaz", () => {
  const s = createOauthState(secret);
  assert.equal(verifyOauthState(s, "baska-secret"), false);
});

test("süresi geçen state reddedilir", () => {
  const s = createOauthState(secret, Date.now() - 11 * 60 * 1000);
  assert.equal(verifyOauthState(s, secret), false);
});

test("nonce üzerinde oynanırsa reddedilir", () => {
  const s = createOauthState(secret);
  const [nonce, exp, sig] = s.split(".");
  const tampered = `${nonce.slice(0, -2)}xx.${exp}.${sig}`;
  assert.equal(verifyOauthState(tampered, secret), false);
});

test("exp üzerinde oynanırsa reddedilir", () => {
  const s = createOauthState(secret);
  const [nonce, exp, sig] = s.split(".");
  const tampered = `${nonce}.${Number(exp) + 60_000}.${sig}`;
  assert.equal(verifyOauthState(tampered, secret), false);
});

test("biçimsiz girdi reddedilir", () => {
  assert.equal(verifyOauthState("", secret), false);
  assert.equal(verifyOauthState("a.b", secret), false);
  assert.equal(verifyOauthState("a.b.c.d", secret), false);
});
