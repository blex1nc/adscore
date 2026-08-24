// Kit builder saf fonksiyon testleri (docs/AGENT-B.md §3).
// Koşturma: apps/web dizininde
//   ../../packages/db/node_modules/.bin/tsx --test src/lib/publish-kit/__tests__/build.test.ts
// (tsx: packages/db devDependency; ek kurulum gerekmez.)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildKit,
  matchCta,
  matchObjective,
  normalizeText,
  slugify,
} from "../build";
import type { BuilderCreative, BuildKitInput, PlanResultShape } from "../types";

const here = dirname(fileURLToPath(import.meta.url));
// Gerçek "Örnek Kahve" planı (2026-08-12, kit alanları eklenmeden önceki şekil)
const OLD_PLAN: PlanResultShape = JSON.parse(
  readFileSync(join(here, "fixture-plan-old.json"), "utf8"),
);

const NOW = new Date("2026-08-23T12:00:00.000Z");

function creative(
  id: string,
  headline: string,
  cta: string,
  approval = "APPROVED",
  images: BuilderCreative["images"] = [],
): BuilderCreative {
  return {
    id,
    approval,
    headline,
    primaryText: `Primary text for ${headline}`,
    description: null,
    cta,
    images,
  };
}

const BRAND = {
  name: "Örnek Kahve",
  website: "https://www.kronotrop.com.tr",
  currency: "TRY",
  targetMarket: "TR",
  copyLanguage: "tr",
};

function baseInput(
  result: unknown,
  creatives: BuilderCreative[],
  overrides: Partial<BuildKitInput> = {},
): BuildKitInput {
  return {
    plan: {
      id: "plan1",
      status: "COMPLETED",
      goal: "SALES",
      budgetType: "DAILY",
      budgetAmount: "500.00",
      currency: "TRY",
      durationDays: 14,
      result,
    },
    creatives,
    brand: BRAND,
    now: NOW,
    ...overrides,
  };
}

const OLD_CREATIVES = [
  creative("c1", "Damak Tadınıza Uygun Kahveyi Keşfedin", "Hemen Keşfet", "APPROVED", [
    { id: "img1", status: "COMPLETED", hasData: true },
    { id: "img-failed", status: "FAILED", hasData: false },
  ]),
  creative("c2", "Damak Tadına Göre Kahve Keşfi", "Alışverişe Başla"),
  creative("c3", "Taze Kavrulmuş Nitelikli Kahveler", "Şimdi Sipariş Ver", "REJECTED"),
];

test("eski plan şekli: kit üretilir, eksik alanlar gaps'e düşer, uydurma yok", () => {
  const kit = buildKit(baseInput(OLD_PLAN, OLD_CREATIVES));

  assert.equal(kit.version, 1);
  assert.equal(kit.generatedAt, NOW.toISOString());
  assert.match(kit.disclaimer, /Bütçe ve harcama tamamen senin kontrolünde/);
  assert.deepEqual(
    kit.sections.map((s) => s.id),
    ["campaign", "adset", "ad"],
  );

  // Objective serbest metinden ("SALES (Satışlar)") Ads Manager hedefine eşlendi
  const objective = kit.sections[0].fields.find((f) => f.id === "campaign.objective")!;
  assert.ok(objective.value, "hedef değeri boş olmamalı");
  assert.match(objective.note ?? "", /OUTCOME_SALES/);
  assert.equal(objective.confidence, "high");
  assert.equal(objective.source, "plan");

  // Bütçe plandan (kullanıcının bütçesi) — AI belirlemez
  assert.deepEqual(
    { ...kit.budget, scenarios: undefined },
    { type: "DAILY", amount: "500.00", currency: "TRY", durationDays: 14, scenarios: undefined },
  );
  assert.ok(Array.isArray(kit.budget.scenarios));

  // Eski planda olmayan alanlar boş + gaps
  const adset = kit.sections[1];
  const convLoc = adset.fields.find((f) => f.id === "adset.0.conversion_location")!;
  assert.equal(convLoc.value, "");
  assert.ok(kit.gaps.some((g) => /Dönüşüm konumu/.test(g)));
  assert.ok(kit.gaps.some((g) => /Bütçe düzeyi/.test(g)));
  assert.ok(kit.gaps.some((g) => /Özel reklam kategorisi/.test(g)));
  // Kullanıcı girdileri henüz yok → gaps
  assert.ok(kit.gaps.some((g) => /Facebook Sayfası/.test(g)));
  assert.ok(kit.gaps.some((g) => /Pixel/.test(g)));

  // Yaş "22 - 48" ayrıştırıldı; konum ve cinsiyet plandan
  assert.equal(adset.fields.find((f) => f.id === "adset.0.age")!.value, "22-48");
  assert.equal(adset.fields.find((f) => f.id === "adset.0.locations")!.value, "Türkiye");
  assert.ok(adset.fields.find((f) => f.id === "adset.0.gender")!.value);
  // Yerleşim: "Advantage+ Yerleşimleri" metni moda eşlendi
  const placements = adset.fields.find((f) => f.id === "adset.0.placements")!;
  assert.match(normalizeText(placements.value), /advantage/);

  // Hedef URL marka web sitesinden (source: brand), kullanıcı değiştirebilir
  const url = kit.sections[2].fields.find((f) => f.id === "ad.destination_url")!;
  assert.equal(url.value, BRAND.website);
  assert.equal(url.source, "brand");

  // Plan data_gaps kitte "Plan notu" olarak korunur
  assert.ok(kit.gaps.some((g) => g.startsWith("Plan notu:")));
});

test("yalnız APPROVED creative'ler kite girer; onaysız olan dışarıda kalır", () => {
  const kit = buildKit(baseInput(OLD_PLAN, OLD_CREATIVES));
  const ids = kit.adsets.flatMap((a) => a.ads.map((ad) => ad.creativeId));
  assert.deepEqual(ids.sort(), ["c1", "c2"]);
  assert.ok(!ids.includes("c3"));
  // Reklam bölümünde reddedilen creative'in alanı yok
  assert.ok(!kit.sections[2].fields.some((f) => f.id.startsWith("ad.c3.")));
  // Yapıdaki başlıklar onaylı creative'lerle eşleşti (tek reklam seti, 2 reklam)
  assert.equal(kit.adsets.length, 1);
  assert.equal(kit.adsets[0].name, "AdSet_TOF_InterestBroad_CreativeAngleTest");
  assert.equal(kit.adsets[0].ads.length, 2);
});

test("görseller: yalnız COMPLETED+data olanlar asset olur; görselsiz creative gaps'e düşer", () => {
  const kit = buildKit(baseInput(OLD_PLAN, OLD_CREATIVES));
  assert.deepEqual(kit.assets, [
    { creativeImageId: "img1", ratios: ["1x1", "4x5", "9x16"] },
  ]);
  assert.ok(kit.gaps.some((g) => /Görsel yok: "Damak Tadına Göre Kahve Keşfi"/.test(g)));
  assert.ok(!kit.gaps.some((g) => /Görsel yok: "Damak Tadınıza Uygun/.test(g)));
});

test("kapılar: COMPLETED olmayan plan ve onaylı creative'siz kit reddedilir", () => {
  assert.throws(
    () =>
      buildKit(
        baseInput(OLD_PLAN, OLD_CREATIVES, {
          plan: { ...baseInput(OLD_PLAN, []).plan, status: "RUNNING" },
        }),
      ),
    /COMPLETED/,
  );
  assert.throws(
    () => buildKit(baseInput(OLD_PLAN, [creative("x", "H", "Hemen Keşfet", "PENDING")])),
    /onaylı creative gerekli/,
  );
});

test("yeni plan şekli: yapılandırılmış alanlar doğrudan kullanılır, gaps azalır", () => {
  const NEW_PLAN: PlanResultShape = {
    ...OLD_PLAN,
    objective: { ...OLD_PLAN.objective, key: "sales" },
    special_ad_category: { recommended: "NONE", reason: "Kahve perakendesi özel kategori kapsamında değil." },
    optimization_event: {
      ...OLD_PLAN.optimization_event,
      conversion_location: "Web sitesi",
      performance_goal: "Dönüşüm sayısını en üst düzeye çıkar",
      event_name: "Purchase",
    },
    audience: {
      ...OLD_PLAN.audience,
      suggestion: {
        ...OLD_PLAN.audience?.suggestion,
        locations: ["Türkiye"],
        age_min: 22,
        age_max: 48,
        gender: "Tümü",
        detailed_targeting: ["Kahve", "Espresso"],
        advantage_plus_audience: true,
      },
    },
    placements: { ...OLD_PLAN.placements, mode: "advantage_plus" },
    budget_plan: { ...OLD_PLAN.budget_plan, level: "campaign" },
  };
  const kit = buildKit(baseInput(NEW_PLAN, OLD_CREATIVES));
  const f = (id: string) =>
    kit.sections.flatMap((s) => s.fields).find((x) => x.id === id)!;

  assert.match(f("campaign.objective").note ?? "", /OUTCOME_SALES/);
  assert.match(f("campaign.special_ad_category").note ?? "", /NONE/);
  assert.equal(f("adset.0.conversion_location").value, "Web sitesi");
  assert.equal(f("adset.0.performance_goal").value, "Dönüşüm sayısını en üst düzeye çıkar");
  assert.equal(f("adset.0.conversion_event").value, "Purchase");
  assert.equal(f("adset.0.age").value, "22-48");
  assert.equal(f("adset.0.detailed_targeting").value, "Kahve, Espresso");
  assert.equal(f("adset.0.advantage_plus_audience").value, "Açık");
  assert.match(f("campaign.budget").value, /500\.00 TRY/);
  assert.equal(f("adset.0.budget_schedule").value, ""); // kampanya bütçesi → sette bütçe yok

  for (const g of kit.gaps) {
    assert.doesNotMatch(g, /Dönüşüm konumu planda yok|Bütçe düzeyi|Özel reklam kategorisi planda/);
  }
});

test("kullanıcı girdileri kite işlenir ve ilgili gaps kapanır", () => {
  const kit = buildKit(
    baseInput(OLD_PLAN, OLD_CREATIVES, {
      inputs: {
        facebookPage: "Örnek Kahve",
        instagramAccount: "@ornekkahve",
        destinationUrl: "https://www.kronotrop.com.tr/deneme-seti",
        pixelDataset: "Örnek Kahve Pixel",
        conversionEvent: "Purchase",
      },
    }),
  );
  const f = (id: string) =>
    kit.sections.flatMap((s) => s.fields).find((x) => x.id === id)!;
  assert.equal(f("ad.identity.page").value, "Örnek Kahve");
  assert.equal(f("ad.identity.page").source, "user_input");
  assert.equal(f("ad.destination_url").value, "https://www.kronotrop.com.tr/deneme-seti");
  assert.equal(f("ad.destination_url").source, "user_input");
  assert.equal(f("adset.0.pixel").value, "Örnek Kahve Pixel");
  assert.equal(f("adset.0.conversion_event").value, "Purchase");
  assert.ok(!kit.gaps.some((g) => /Facebook Sayfası|Pixel \/ veri seti|Hedef URL|Dönüşüm event/.test(g)));
  assert.deepEqual(kit.inputs.facebookPage, "Örnek Kahve");
});

test("yapısız plan: tüm onaylı creative'ler tek reklam setine düşer ve gap yazılır", () => {
  const kit = buildKit(baseInput({ campaign_name: "X" }, OLD_CREATIVES));
  assert.equal(kit.adsets.length, 1);
  assert.equal(kit.adsets[0].ads.length, 2);
  assert.ok(kit.gaps.some((g) => /reklam seti yapısı içermiyor/.test(g)));
  // Objective hiç yok → değer boş + gap
  const objective = kit.sections[0].fields.find((x) => x.id === "campaign.objective")!;
  assert.equal(objective.value, "");
  assert.ok(kit.gaps.some((g) => /kampanya hedefi/i.test(g)));
});

test("CTA eşleme: tam, yaklaşık ve eşleşmeyen", () => {
  assert.equal(matchCta("Shop now").match, "exact");
  assert.equal(matchCta("SHOP_NOW").apiEnum, "SHOP_NOW");
  assert.equal(matchCta("Hemen Keşfet").match, "approximate");
  assert.equal(matchCta("Bambaşka Bir Şey").match, "none");
  assert.equal(matchCta("").match, "none");

  const kit = buildKit(
    baseInput(OLD_PLAN, [
      creative("c9", "Damak Tadınıza Uygun Kahveyi Keşfedin", "Bambaşka Bir Şey"),
    ]),
  );
  const cta = kit.sections[2].fields.find((x) => x.id === "ad.c9.cta")!;
  assert.equal(cta.value, "Bambaşka Bir Şey");
  assert.match(cta.note ?? "", /eşleştirilemedi/);
  assert.ok(kit.gaps.some((g) => /CTA "Bambaşka Bir Şey"/.test(g)));
});

test("objective eşleme: key, API enum ve serbest metin", () => {
  assert.equal(matchObjective("sales", undefined)?.apiEnum, "OUTCOME_SALES");
  assert.equal(matchObjective("OUTCOME_TRAFFIC", undefined)?.apiEnum, "OUTCOME_TRAFFIC");
  assert.equal(matchObjective(undefined, "SALES (Satışlar)")?.apiEnum, "OUTCOME_SALES");
  assert.equal(matchObjective(undefined, "Potansiyel müşteriler")?.apiEnum, "OUTCOME_LEADS");
  assert.equal(matchObjective(undefined, "bilinmeyen"), null);
});

test("copy alanları karakter sınırıyla gelir; slug ASCII'dir", () => {
  const kit = buildKit(baseInput(OLD_PLAN, OLD_CREATIVES));
  const headline = kit.sections[2].fields.find((x) => x.id === "ad.c1.headline")!;
  assert.ok(typeof headline.charLimit === "number" && headline.charLimit > 0);
  assert.ok(headline.sourceUrl?.startsWith("https://"));
  assert.equal(slugify("Alışverişe Başla — Şimdi!"), "alisverise-basla-simdi");
  assert.equal(slugify(""), "reklam");
});

test("checklist adım id'leri bölümler arasında benzersizdir", () => {
  const kit = buildKit(baseInput(OLD_PLAN, OLD_CREATIVES));
  const ids = kit.sections.flatMap((s) => s.steps.map((st) => st.id));
  assert.equal(new Set(ids).size, ids.length);
  const fieldIds = kit.sections.flatMap((s) => s.fields.map((f) => f.id));
  assert.equal(new Set(fieldIds).size, fieldIds.length);
});
