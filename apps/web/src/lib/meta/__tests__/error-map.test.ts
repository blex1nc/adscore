import { test } from "node:test";
import assert from "node:assert/strict";
import { mapMetaError, parseUsagePct } from "../error-map";

test("190: auth hatası — transient değil, TR yeniden bağlan mesajı", () => {
  const m = mapMetaError(400, { code: 190, message: "expired" });
  assert.equal(m.isAuth, true);
  assert.equal(m.isTransient, false);
  assert.match(m.userMessage, /yeniden bağlan/i);
});

test("4 ve 17: rate limit + transient", () => {
  for (const code of [4, 17]) {
    const m = mapMetaError(400, { code });
    assert.equal(m.isRateLimit, true);
    assert.equal(m.isTransient, true);
  }
});

test("80004 (BUC ads management): rate limit", () => {
  const m = mapMetaError(400, { code: 80004 });
  assert.equal(m.isRateLimit, true);
});

test("10 ve 200-299: izin hatası", () => {
  for (const code of [10, 200, 272, 299]) {
    const m = mapMetaError(403, { code });
    assert.equal(m.isPermission, true, `code ${code}`);
    assert.match(m.userMessage, /izin/i);
  }
});

test("1 ve 2: geçici hata, rate limit değil", () => {
  for (const code of [1, 2]) {
    const m = mapMetaError(500, { code });
    assert.equal(m.isTransient, true);
    assert.equal(m.isRateLimit, false);
  }
});

test("HTTP 5xx gövdesiz: transient", () => {
  const m = mapMetaError(503, null);
  assert.equal(m.isTransient, true);
});

test("HTTP 429: rate limit (gövde kodu ne olursa olsun)", () => {
  const m = mapMetaError(429, { code: 613 });
  assert.equal(m.isRateLimit, true);
});

test("bilinmeyen hata: Meta mesajı kullanıcı mesajına taşınır", () => {
  const m = mapMetaError(400, {
    code: 100,
    message: "Invalid parameter",
    error_subcode: 33,
    fbtrace_id: "abc",
  });
  assert.equal(m.subcode, 33);
  assert.equal(m.fbtraceId, "abc");
  assert.match(m.userMessage, /Invalid parameter/);
});

test("parseUsagePct: X-App-Usage'dan en yüksek yüzde", () => {
  const pct = parseUsagePct({
    appUsage: '{"call_count":25,"total_time":10,"total_cputime":80}',
  });
  assert.equal(pct, 80);
});

test("parseUsagePct: X-Ad-Account-Usage acc_id_util_pct", () => {
  const pct = parseUsagePct({ adAccountUsage: '{"acc_id_util_pct":9.5}' });
  assert.equal(pct, 10);
});

test("parseUsagePct: BUC başlığı (business id → dizi) desteklenir", () => {
  const pct = parseUsagePct({
    bucUsage:
      '{"123456":[{"type":"ads_management","call_count":42,"total_cputime":5,"total_time":12,"estimated_time_to_regain_access":0}]}',
  });
  assert.equal(pct, 42);
});

test("parseUsagePct: başlık yoksa null", () => {
  assert.equal(parseUsagePct({}), null);
});

test("parseUsagePct: bozuk JSON null döner, patlamaz", () => {
  assert.equal(parseUsagePct({ appUsage: "not-json" }), null);
});
