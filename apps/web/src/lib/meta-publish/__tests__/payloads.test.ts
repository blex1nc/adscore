// Meta payload üreticisi birim testleri (AGENT-B.md §5.3 — özellikle bütçe birimi
// ve object_story_spec). Koşturma: apps/web dizininde
//   ../../packages/db/node_modules/.bin/tsx --test src/lib/meta-publish/__tests__/payloads.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MetaPayloadError,
  PAUSED_STATUS,
  adsManagerCampaignUrl,
  assertCurrencyMatch,
  buildAdPayload,
  buildAdSetPayload,
  buildCampaignPayload,
  buildCreativePayload,
  buildTargetingSpec,
  currencyOffset,
  fromMinorUnits,
  isCurveInsufficient,
  isSupportedObjective,
  resolveOptimization,
  toMinorUnits,
} from "../payloads";
import type {
  PublishBindingInput,
  PublishCreativeInput,
  PublishPlanInput,
  StoredTargeting,
} from "../types";

// Kırmızı çizgi testinde aranan yasak durum — kaynakta düz yazılmaz (grep temiz kalsın)
const FORBIDDEN_STATUS = "ACT" + "IVE";

const PLAN: PublishPlanInput = {
  id: "plan1",
  goal: "Satış",
  budgetType: "DAILY",
  budgetAmount: "250.00",
  currency: "TRY",
  durationDays: 7,
  objectiveKey: "traffic",
  specialAdCategories: ["NONE"],
};

const BINDING: PublishBindingInput = {
  adAccountId: "act_123456",
  pageId: "111222333",
  instagramActorId: "444555666",
  pixelId: "777888999",
  currency: "TRY",
};

const TARGETING: StoredTargeting = {
  version: 1,
  countries: ["TR"],
  ageMin: 25,
  ageMax: 45,
  gender: "women",
  interests: [
    {
      id: "6003139266461",
      name: "Kahve",
      type: "interests",
      audienceSizeLowerBound: 100000,
      audienceSizeUpperBound: 200000,
      path: ["İlgi Alanları", "Kahve"],
      source: "meta_search",
      retrievedAt: "2026-08-24T10:00:00.000Z",
    },
  ],
  behaviors: [],
  advantageAudience: false,
};

const CREATIVE: PublishCreativeInput = {
  id: "cr1",
  headline: "Taze kavrulmuş kahve",
  primaryText: "Haftalık kavrum, kapında.",
  description: "Ücretsiz kargo",
  ctaEnum: "SHOP_NOW",
  destinationUrl: "https://ornekkahve.example/shop",
  imageHash: "abc123hash",
};

// ---------------------------------------------------------------------------
// Bütçe birimi (EN PAHALI HATA — SOURCES-B §2–§3)
// ---------------------------------------------------------------------------

test("toMinorUnits: TRY offset 100 — 250.00 TL = 25000 kuruş", () => {
  assert.equal(toMinorUnits("250.00", "TRY"), 25000);
  assert.equal(toMinorUnits("250", "TRY"), 25000);
  assert.equal(toMinorUnits("250.5", "TRY"), 25050);
  assert.equal(toMinorUnits("0.50", "TRY"), 50);
  assert.equal(toMinorUnits("1234.56", "TRY"), 123456);
});

test("toMinorUnits: offset 1 para birimi (JPY) tam birim gönderir", () => {
  assert.equal(currencyOffset("JPY"), 1);
  assert.equal(currencyOffset("TRY"), 100);
  assert.equal(toMinorUnits("250", "JPY"), 250); // 250 yen = 250 (25000 DEĞİL)
  assert.equal(toMinorUnits("250.00", "JPY"), 250); // sondaki sıfırlar sorun değil
});

test("toMinorUnits: fazla ondalık reddedilir (yuvarlama = bütçe değişimi)", () => {
  assert.throws(() => toMinorUnits("250.505", "TRY"), MetaPayloadError);
  assert.throws(() => toMinorUnits("250.5", "JPY"), MetaPayloadError);
});

test("toMinorUnits: geçersiz/negatif/sıfır tutar reddedilir", () => {
  assert.throws(() => toMinorUnits("abc", "TRY"), MetaPayloadError);
  assert.throws(() => toMinorUnits("-5", "TRY"), MetaPayloadError);
  assert.throws(() => toMinorUnits("0", "TRY"), MetaPayloadError);
  assert.throws(() => toMinorUnits("", "TRY"), MetaPayloadError);
});

test("fromMinorUnits: kullanıcıya hesap para biriminde geri gösterim", () => {
  assert.equal(fromMinorUnits(25000, "TRY"), "250.00");
  assert.equal(fromMinorUnits(25050, "TRY"), "250.50");
  assert.equal(fromMinorUnits(250, "JPY"), "250");
});

test("assertCurrencyMatch: plan ≠ hesap para birimi yayını durdurur", () => {
  assert.throws(() => assertCurrencyMatch("USD", "TRY"), MetaPayloadError);
  assert.doesNotThrow(() => assertCurrencyMatch("try", "TRY"));
});

// ---------------------------------------------------------------------------
// Objective / optimizasyon (SOURCES-B §13–§14)
// ---------------------------------------------------------------------------

test("resolveOptimization: traffic → LINK_CLICKS, promoted_object yok", () => {
  const o = resolveOptimization({ objectiveKey: "traffic", pixelId: null });
  assert.equal(o.optimizationGoal, "LINK_CLICKS");
  assert.equal(o.billingEvent, "IMPRESSIONS");
  assert.equal(o.promotedObject, null);
});

test("resolveOptimization: sales + pixel + event → OFFSITE_CONVERSIONS", () => {
  const o = resolveOptimization({ objectiveKey: "sales", pixelId: "777", customEventType: "PURCHASE" });
  assert.equal(o.optimizationGoal, "OFFSITE_CONVERSIONS");
  assert.deepEqual(o.promotedObject, { pixel_id: "777", custom_event_type: "PURCHASE" });
});

test("resolveOptimization: sales pixel'siz DÜRÜST hata (fallback uydurulmaz)", () => {
  assert.throws(() => resolveOptimization({ objectiveKey: "sales", pixelId: null }), MetaPayloadError);
  assert.throws(
    () => resolveOptimization({ objectiveKey: "sales", pixelId: "777", customEventType: null }),
    MetaPayloadError,
  );
});

test("resolveOptimization: desteklenmeyen amaç PublishKit'e yönlendirir", () => {
  assert.equal(isSupportedObjective("awareness"), false);
  assert.throws(() => resolveOptimization({ objectiveKey: "awareness", pixelId: null }), MetaPayloadError);
});

// ---------------------------------------------------------------------------
// Targeting spec (SOURCES-B §6–§8)
// ---------------------------------------------------------------------------

test("buildTargetingSpec: ülke + yaş + cinsiyet + interests + advantage_audience bayrağı", () => {
  const spec = buildTargetingSpec(TARGETING);
  assert.deepEqual(spec.geo_locations, { countries: ["TR"] });
  assert.equal(spec.age_min, 25);
  assert.equal(spec.age_max, 45);
  assert.deepEqual(spec.genders, [2]); // kadın = 2
  assert.deepEqual(spec.interests, [{ id: "6003139266461", name: "Kahve" }]);
  // v23+ zorunlu bayrak HER ZAMAN açıkça gönderilir (SOURCES-B §8)
  assert.deepEqual(spec.targeting_automation, { advantage_audience: 0 });
});

test("buildTargetingSpec: advantage_audience=true → 1", () => {
  const spec = buildTargetingSpec({ ...TARGETING, advantageAudience: true });
  assert.deepEqual(spec.targeting_automation, { advantage_audience: 1 });
});

test("buildTargetingSpec: ülkesiz hedefleme reddedilir", () => {
  assert.throws(() => buildTargetingSpec({ ...TARGETING, countries: [] }), MetaPayloadError);
});

test("buildTargetingSpec: aramadan gelmeyen/uydurma id reddedilir (CLAUDE.md §6)", () => {
  const fake = {
    ...TARGETING,
    interests: [{ ...TARGETING.interests[0], source: "ai_guess" as never }],
  };
  assert.throws(() => buildTargetingSpec(fake), MetaPayloadError);
  const badId = {
    ...TARGETING,
    interests: [{ ...TARGETING.interests[0], id: "kahve-severler" }],
  };
  assert.throws(() => buildTargetingSpec(badId), MetaPayloadError);
});

// ---------------------------------------------------------------------------
// Kampanya payload'ı (SOURCES-B §1)
// ---------------------------------------------------------------------------

test("buildCampaignPayload: PAUSED + ODAX enum + NONE → boş special_ad_categories", () => {
  const p = buildCampaignPayload({ plan: PLAN, campaignName: "Örnek Kahve — Trafik" });
  assert.equal(p.status, PAUSED_STATUS);
  assert.equal(p.objective, "OUTCOME_TRAFFIC");
  assert.deepEqual(p.special_ad_categories, []); // "NONE" → boş dizi (resmî kural)
  assert.equal(p.buying_type, "AUCTION");
  // Kampanya payload'ında hiçbir bütçe alanı YOK
  assert.ok(!("daily_budget" in p) && !("lifetime_budget" in p) && !("spend_cap" in p));
});

test("buildCampaignPayload: gerçek özel kategori aynen korunur", () => {
  const p = buildCampaignPayload({
    plan: { ...PLAN, specialAdCategories: ["HOUSING"] },
    campaignName: "X",
  });
  assert.deepEqual(p.special_ad_categories, ["HOUSING"]);
});

test("buildCampaignPayload: desteklenmeyen amaç reddedilir", () => {
  assert.throws(
    () => buildCampaignPayload({ plan: { ...PLAN, objectiveKey: "engagement" }, campaignName: "X" }),
    MetaPayloadError,
  );
});

// ---------------------------------------------------------------------------
// Ad set payload'ı (SOURCES-B §2)
// ---------------------------------------------------------------------------

const OPT = resolveOptimization({ objectiveKey: "traffic", pixelId: null });

test("buildAdSetPayload: DAILY → daily_budget minor unit, PAUSED, bid alanı yok", () => {
  const p = buildAdSetPayload({
    plan: PLAN,
    binding: BINDING,
    campaignId: "camp123",
    adSetName: "Set 1",
    targeting: TARGETING,
    optimization: OPT,
  });
  assert.equal(p.status, PAUSED_STATUS);
  assert.equal(p.campaign_id, "camp123");
  assert.equal(p.daily_budget, 25000); // 250.00 TL = 25000 kuruş
  assert.ok(!("lifetime_budget" in p));
  assert.ok(!("bid_amount" in p) && !("bid_strategy" in p)); // bid bu sprintte yazılmaz
  assert.equal(p.optimization_goal, "LINK_CLICKS");
  assert.equal(p.billing_event, "IMPRESSIONS");
});

test("buildAdSetPayload: LIFETIME tarihsiz reddedilir; tarihli kabul edilir", () => {
  const lifetimePlan: PublishPlanInput = { ...PLAN, budgetType: "LIFETIME", budgetAmount: "1750" };
  assert.throws(
    () =>
      buildAdSetPayload({
        plan: lifetimePlan,
        binding: BINDING,
        campaignId: "c",
        adSetName: "s",
        targeting: TARGETING,
        optimization: OPT,
      }),
    MetaPayloadError,
  );
  const p = buildAdSetPayload({
    plan: lifetimePlan,
    binding: BINDING,
    campaignId: "c",
    adSetName: "s",
    targeting: TARGETING,
    optimization: OPT,
    startTime: "2026-08-25T00:00:00+03:00",
    endTime: "2026-09-01T00:00:00+03:00",
  });
  assert.equal(p.lifetime_budget, 175000);
  assert.ok(!("daily_budget" in p));
  assert.equal(p.end_time, "2026-09-01T00:00:00+03:00");
});

test("buildAdSetPayload: plan ≠ hesap para birimi yayını durdurur", () => {
  assert.throws(
    () =>
      buildAdSetPayload({
        plan: { ...PLAN, currency: "USD" },
        binding: BINDING,
        campaignId: "c",
        adSetName: "s",
        targeting: TARGETING,
        optimization: OPT,
      }),
    MetaPayloadError,
  );
});

test("buildAdSetPayload: sales yolu promoted_object taşır", () => {
  const salesOpt = resolveOptimization({ objectiveKey: "sales", pixelId: "777", customEventType: "PURCHASE" });
  const p = buildAdSetPayload({
    plan: { ...PLAN, objectiveKey: "sales" },
    binding: BINDING,
    campaignId: "c",
    adSetName: "s",
    targeting: TARGETING,
    optimization: salesOpt,
  });
  assert.deepEqual(p.promoted_object, { pixel_id: "777", custom_event_type: "PURCHASE" });
});

// ---------------------------------------------------------------------------
// Creative payload'ı (SOURCES-B §4 — object_story_spec)
// ---------------------------------------------------------------------------

test("buildCreativePayload: page_id + instagram_user_id + link_data alanları", () => {
  const p = buildCreativePayload({ creative: CREATIVE, binding: BINDING, creativeName: "Creative 1" });
  assert.equal(p.object_story_spec.page_id, "111222333");
  // Binding'deki instagramActorId GÜNCEL alan adı instagram_user_id ile gider
  assert.equal(p.object_story_spec.instagram_user_id, "444555666");
  const ld = p.object_story_spec.link_data;
  assert.equal(ld.link, CREATIVE.destinationUrl);
  assert.equal(ld.message, CREATIVE.primaryText);
  assert.equal(ld.name, CREATIVE.headline);
  assert.equal(ld.description, "Ücretsiz kargo");
  assert.equal(ld.image_hash, "abc123hash");
  // CTA link'i ana link ile AYNI olmalı (resmî kural)
  assert.deepEqual(ld.call_to_action, { type: "SHOP_NOW", value: { link: CREATIVE.destinationUrl } });
});

test("buildCreativePayload: Page yoksa dürüst hata (yayının ön koşulu)", () => {
  assert.throws(
    () =>
      buildCreativePayload({
        creative: CREATIVE,
        binding: { ...BINDING, pageId: "" },
        creativeName: "X",
      }),
    MetaPayloadError,
  );
});

test("buildCreativePayload: görsel hash'siz / URL bozuk reddedilir", () => {
  assert.throws(
    () => buildCreativePayload({ creative: { ...CREATIVE, imageHash: "" }, binding: BINDING, creativeName: "X" }),
    MetaPayloadError,
  );
  assert.throws(
    () =>
      buildCreativePayload({
        creative: { ...CREATIVE, destinationUrl: "ornekkahve" },
        binding: BINDING,
        creativeName: "X",
      }),
    MetaPayloadError,
  );
});

test("buildCreativePayload: IG bağlı değilse instagram_user_id gönderilmez; CTA'sız creative CTA alanı taşımaz", () => {
  const p = buildCreativePayload({
    creative: { ...CREATIVE, ctaEnum: null, description: null },
    binding: { ...BINDING, instagramActorId: null },
    creativeName: "X",
  });
  assert.ok(!("instagram_user_id" in p.object_story_spec));
  assert.ok(!("call_to_action" in p.object_story_spec.link_data));
  assert.ok(!("description" in p.object_story_spec.link_data));
});

// ---------------------------------------------------------------------------
// Ad payload'ı (SOURCES-B §5)
// ---------------------------------------------------------------------------

test("buildAdPayload: creative_id referansı + PAUSED", () => {
  const p = buildAdPayload({ adName: "Reklam 1", adSetId: "as1", creativeId: "cr9" });
  assert.deepEqual(p, {
    name: "Reklam 1",
    adset_id: "as1",
    creative: { creative_id: "cr9" },
    status: PAUSED_STATUS,
  });
});

// ---------------------------------------------------------------------------
// KIRMIZI ÇİZGİ: hiçbir üretici çıktısında yasak durum/bütçe sapması olamaz
// ---------------------------------------------------------------------------

test("kırmızı çizgi: tüm payload'lar PAUSED; yasak durum hiçbir çıktıda geçmez", () => {
  const campaign = buildCampaignPayload({ plan: PLAN, campaignName: "K" });
  const adset = buildAdSetPayload({
    plan: PLAN,
    binding: BINDING,
    campaignId: "c",
    adSetName: "s",
    targeting: TARGETING,
    optimization: OPT,
  });
  const creativeP = buildCreativePayload({ creative: CREATIVE, binding: BINDING, creativeName: "cr" });
  const ad = buildAdPayload({ adName: "a", adSetId: "s", creativeId: "c" });
  for (const payload of [campaign, adset, creativeP, ad]) {
    const json = JSON.stringify(payload);
    assert.ok(!json.includes(FORBIDDEN_STATUS), `yasak durum bulundu: ${json}`);
  }
  assert.equal(campaign.status, "PAUSED");
  assert.equal(adset.status, "PAUSED");
  assert.equal(ad.status, "PAUSED");
});

test("kırmızı çizgi: ad set bütçesi = onaylı plan bütçesinin birebir minor-unit karşılığı", () => {
  const adset = buildAdSetPayload({
    plan: PLAN,
    binding: BINDING,
    campaignId: "c",
    adSetName: "s",
    targeting: TARGETING,
    optimization: OPT,
  });
  assert.equal(fromMinorUnits(adset.daily_budget!, BINDING.currency), "250.00");
});

// ---------------------------------------------------------------------------
// Delivery estimate yorumu (SOURCES-B §9)
// ---------------------------------------------------------------------------

test("isCurveInsufficient: boş / eksik / tek-nokta-hepsi-0 → Insufficient Data", () => {
  assert.equal(isCurveInsufficient(undefined), true);
  assert.equal(isCurveInsufficient(null), true);
  assert.equal(isCurveInsufficient([]), true);
  // Resmî davranış: güven yoksa "an array of 1 point with all 0s"
  assert.equal(isCurveInsufficient([{ spend: 0, reach: 0, impressions: 0, actions: 0 }]), true);
});

test("isCurveInsufficient: gerçek eğri yeterli sayılır", () => {
  assert.equal(isCurveInsufficient([{ spend: 100, reach: 2000, impressions: 3000, actions: 12 }]), false);
  assert.equal(
    isCurveInsufficient([
      { spend: 0, reach: 0, impressions: 0, actions: 0 },
      { spend: 100, reach: 2000, impressions: 3000, actions: 12 },
    ]),
    false,
  );
});

// ---------------------------------------------------------------------------
// Ads Manager derin linkleri
// ---------------------------------------------------------------------------

test("adsManagerCampaignUrl: act_ öneki soyulur", () => {
  assert.equal(
    adsManagerCampaignUrl("act_123456", "789"),
    "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=123456&selected_campaign_ids=789",
  );
});
