// Aşama mantığı saf testleri (claim/idempotens desteği: sıra, yetim riski, parse).
// Koşturma: apps/web dizininde
//   ../../packages/db/node_modules/.bin/tsx --test src/lib/meta-publish/__tests__/stages.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STAGE_ORDER,
  hasOrphanRisk,
  isPublishStage,
  nextStage,
  parseAdImagesResponse,
  readRequestJson,
  readStoredTargeting,
  type PublishRequestJson,
} from "../stages";

const SELECTION = {
  creativeId: "c1",
  imageId: "i1",
  destinationUrl: "https://x.example",
  ctaEnum: null,
  customEventType: null,
  trafficGoal: null,
  campaignName: "K",
  adSetName: "S",
  adName: "A",
  startTime: null,
  endTime: null,
};

test("aşama sırası: CAMPAIGN → ADSET → MEDIA → CREATIVE → AD → DONE", () => {
  assert.deepEqual([...STAGE_ORDER], ["CAMPAIGN", "ADSET", "MEDIA", "CREATIVE", "AD"]);
  assert.equal(nextStage("CAMPAIGN"), "ADSET");
  assert.equal(nextStage("MEDIA"), "CREATIVE"); // ad, creative_id'ye referans verir
  assert.equal(nextStage("AD"), "DONE");
  assert.equal(isPublishStage("DONE"), false);
  assert.equal(isPublishStage("ADSET"), true);
});

test("yetim riski: sent var + cevap yok → körlemesine tekrar YOK (Arena dersi)", () => {
  const req: PublishRequestJson = {
    version: 1,
    selection: SELECTION,
    attempts: { CAMPAIGN: 1 },
    sent: { CAMPAIGN: { name: "K" } },
  };
  assert.equal(hasOrphanRisk(req, {}, "CAMPAIGN"), true);
  // cevap kaydedilmişse risk yok
  assert.equal(hasOrphanRisk(req, { CAMPAIGN: { id: "1" } }, "CAMPAIGN"), false);
  // hiç gönderilmemişse risk yok
  assert.equal(hasOrphanRisk(req, {}, "ADSET"), false);
  assert.equal(hasOrphanRisk(null, {}, "CAMPAIGN"), false);
});

test("readRequestJson: bozuk kayıt null; sağlam kayıt normalize", () => {
  assert.equal(readRequestJson(null), null);
  assert.equal(readRequestJson({ version: 2 }), null);
  const ok = readRequestJson({ version: 1, selection: SELECTION });
  assert.ok(ok);
  assert.deepEqual(ok!.attempts, {});
  assert.deepEqual(ok!.sent, {});
});

test("parseAdImagesResponse: hash çıkarımı", () => {
  assert.equal(
    parseAdImagesResponse({ images: { "adscore-i1.png": { hash: "abc123" } } }),
    "abc123",
  );
  assert.equal(parseAdImagesResponse({ images: {} }), null);
  assert.equal(parseAdImagesResponse({}), null);
  assert.equal(parseAdImagesResponse(null), null);
});

const STORED = {
  version: 1,
  countries: ["TR"],
  ageMin: 25,
  ageMax: 45,
  gender: "women",
  interests: [
    {
      id: "6003",
      name: "Kahve",
      type: "interests",
      audienceSizeLowerBound: 1,
      audienceSizeUpperBound: 2,
      path: [],
      source: "meta_search",
      retrievedAt: "2026-08-24T00:00:00Z",
    },
  ],
  behaviors: [],
  advantageAudience: false,
};

test("readStoredTargeting: sağlam kayıt geçer", () => {
  const t = readStoredTargeting(STORED);
  assert.ok(t);
  assert.deepEqual(t!.countries, ["TR"]);
  assert.equal(t!.interests[0].id, "6003");
});

test("readStoredTargeting: uydurma id / yanlış kaynak / ülkesiz → null (CLAUDE.md §6)", () => {
  assert.equal(readStoredTargeting(null), null);
  assert.equal(readStoredTargeting({ ...STORED, countries: [] }), null);
  assert.equal(readStoredTargeting({ ...STORED, countries: ["Türkiye"] }), null);
  assert.equal(
    readStoredTargeting({
      ...STORED,
      interests: [{ ...STORED.interests[0], source: "ai_guess" }],
    }),
    null,
  );
  assert.equal(
    readStoredTargeting({
      ...STORED,
      interests: [{ ...STORED.interests[0], id: "kahve" }],
    }),
    null,
  );
  assert.equal(readStoredTargeting({ ...STORED, advantageAudience: "yes" }), null);
});
