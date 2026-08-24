import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { parseSignedRequest } from "../signed-request";

const secret = "app-secret";

function make(payload: object, sec = secret): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sec).update(encoded).digest("base64url");
  return `${sig}.${encoded}`;
}

test("geçerli signed_request ayrıştırılır", () => {
  const sr = make({
    algorithm: "HMAC-SHA256",
    user_id: "1234567890",
    issued_at: 1756000000,
  });
  const p = parseSignedRequest(sr, secret);
  assert.ok(p);
  assert.equal(p.user_id, "1234567890");
});

test("yanlış secret ile imza reddedilir (null)", () => {
  const sr = make({ algorithm: "HMAC-SHA256", user_id: "1" }, "yanlis");
  assert.equal(parseSignedRequest(sr, secret), null);
});

test("payload üzerinde oynanırsa reddedilir", () => {
  const sr = make({ algorithm: "HMAC-SHA256", user_id: "1" });
  const [sig] = sr.split(".");
  const forged = Buffer.from(
    JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "999" }),
  ).toString("base64url");
  assert.equal(parseSignedRequest(`${sig}.${forged}`, secret), null);
});

test("bilinmeyen algoritma reddedilir", () => {
  const sr = make({ algorithm: "MD5", user_id: "1" });
  assert.equal(parseSignedRequest(sr, secret), null);
});

test("biçimsiz girdi null döner, throw etmez", () => {
  assert.equal(parseSignedRequest("", secret), null);
  assert.equal(parseSignedRequest("noktasiz", secret), null);
  assert.equal(parseSignedRequest(".basibos", secret), null);
});
