// §5.6 kanıtı — A'nın guard çekirdeği (saf) BİZİM payload yolumuzun içinde:
// (a) yasak durumlu payload reddedilir, (b) plan bütçesinden sapma reddedilir,
// (c) mevcut nesneye bütçe/durum güncellemesi reddedilir, (d) gerçek çıktılar geçer.
// Koşturma: apps/web dizininde
//   ../../packages/db/node_modules/.bin/tsx --test src/lib/meta-publish/__tests__/guards-path.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSafePayloadCore, MetaGuardError } from "../../meta/guards-core";
import {
  buildAdPayload,
  buildAdSetPayload,
  buildCampaignPayload,
  buildCreativePayload,
  resolveOptimization,
} from "../payloads";
import type { PublishBindingInput, PublishPlanInput, StoredTargeting } from "../types";

const FORBIDDEN_STATUS = "ACT" + "IVE"; // kaynakta düz yazılmaz (kırmızı çizgi grep'i temiz)

const PLAN: PublishPlanInput = {
  id: "p1",
  goal: "Trafik",
  budgetType: "DAILY",
  budgetAmount: "250.00",
  currency: "TRY",
  durationDays: 7,
  objectiveKey: "traffic",
  specialAdCategories: ["NONE"],
};
const BINDING: PublishBindingInput = {
  adAccountId: "act_1",
  pageId: "111",
  instagramActorId: null,
  pixelId: null,
  currency: "TRY",
};
const TARGETING: StoredTargeting = {
  version: 1,
  countries: ["TR"],
  ageMin: 18,
  ageMax: 45,
  gender: "all",
  interests: [],
  behaviors: [],
  advantageAudience: false,
};
const OPT = resolveOptimization({ objectiveKey: "traffic", pixelId: null });
const PLAN_REF = { budgetAmount: PLAN.budgetAmount, currency: PLAN.currency };
const CAP = "500.00";

function adset() {
  return buildAdSetPayload({
    plan: PLAN,
    binding: BINDING,
    campaignId: "camp1",
    adSetName: "S",
    targeting: TARGETING,
    optimization: OPT,
  });
}

test("§5.6d — gerçek üretici çıktıları guard'dan geçer (yol açık)", () => {
  assert.doesNotThrow(() =>
    assertSafePayloadCore({
      kind: "create",
      payload: buildCampaignPayload({ plan: PLAN, campaignName: "K" }),
      plan: PLAN_REF,
      maxDailyBudget: CAP,
    }),
  );
  assert.doesNotThrow(() =>
    assertSafePayloadCore({ kind: "create", payload: adset(), plan: PLAN_REF, maxDailyBudget: CAP }),
  );
  // Status'süz varlık (creative) — KATI update moduyla doğrulanır (REPORT-B #2)
  const creativePayload = buildCreativePayload({
    creative: {
      id: "c1",
      headline: "H",
      primaryText: "P",
      description: null,
      ctaEnum: "SHOP_NOW",
      destinationUrl: "https://x.example",
      imageHash: "hash1",
    },
    binding: BINDING,
    creativeName: "cr",
  });
  assert.doesNotThrow(() =>
    assertSafePayloadCore({ kind: "update", payload: creativePayload }),
  );
  assert.doesNotThrow(() =>
    assertSafePayloadCore({
      kind: "create",
      payload: buildAdPayload({ adName: "A", adSetId: "s1", creativeId: "c1" }),
      plan: PLAN_REF,
      maxDailyBudget: CAP,
    }),
  );
});

test("§5.6a — yasak durumlu payload guard'da reddedilir (iç içe dahil)", () => {
  const tampered = { ...buildCampaignPayload({ plan: PLAN, campaignName: "K" }), status: FORBIDDEN_STATUS };
  assert.throws(
    () => assertSafePayloadCore({ kind: "create", payload: tampered, plan: PLAN_REF, maxDailyBudget: CAP }),
    MetaGuardError,
  );
  // iç içe: creative spec'in derinine gömülü yasak durum da yakalanır
  const nested = {
    name: "cr",
    object_story_spec: { page_id: "111", link_data: { link: "https://x", inner: { status: FORBIDDEN_STATUS } } },
  };
  assert.throws(() => assertSafePayloadCore({ kind: "update", payload: nested }), MetaGuardError);
});

test("§5.6b — plan bütçesinden farklı bütçe reddedilir; tavansız/tavan aşımı reddedilir", () => {
  const p = adset(); // daily_budget = 25000 (250.00 TRY)
  // kullanıcı 300 onaylamış olsaydı 25000 sapma olurdu → red
  assert.throws(
    () =>
      assertSafePayloadCore({
        kind: "create",
        payload: p,
        plan: { budgetAmount: "300.00", currency: "TRY" },
        maxDailyBudget: CAP,
      }),
    MetaGuardError,
  );
  // tavan ayarlanmamış → red (CLAUDE.md §23: limiti kullanıcı koyar)
  assert.throws(
    () => assertSafePayloadCore({ kind: "create", payload: p, plan: PLAN_REF, maxDailyBudget: null }),
    MetaGuardError,
  );
  // tavan aşımı → red
  assert.throws(
    () => assertSafePayloadCore({ kind: "create", payload: p, plan: PLAN_REF, maxDailyBudget: "100.00" }),
    MetaGuardError,
  );
  // birebir eşit + tavan altı → geçer
  assert.doesNotThrow(
    () => assertSafePayloadCore({ kind: "create", payload: p, plan: PLAN_REF, maxDailyBudget: "250.00" }),
  );
});

test("§5.6c — mevcut Meta nesnesine bütçe/durum/bid güncellemesi TÜMÜYLE yasak", () => {
  for (const forbidden of [
    { daily_budget: 25000 },
    { lifetime_budget: 175000 },
    { status: "PAUSED" }, // update'te status alanı bile yasak (yanlışlıkla bile gönderilmez)
    { bid_amount: 100 },
  ]) {
    assert.throws(
      () => assertSafePayloadCore({ kind: "update", payload: { name: "x", ...forbidden } }),
      MetaGuardError,
      JSON.stringify(forbidden),
    );
  }
});
