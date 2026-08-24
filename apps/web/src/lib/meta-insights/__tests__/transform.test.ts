// Dönüştürücü birim testleri — AGENT-C.md §5.4.
// Fixture'lar YALNIZ birim test girdisidir (CONTRACTS §1: ürün yolunda mock yasak).
// Alan adları/biçimleri SOURCES-C.md §1–§3'te doğrulanan gerçek cevap yapısına göre.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  transformInsightsToResultDraft,
  type MetaInsightsRow,
} from "../transform";

// Tipik kampanya seviyesi, time_increment=all_days (tek toplam satır) cevabı
function baseRow(overrides: Partial<MetaInsightsRow> = {}): MetaInsightsRow {
  return {
    spend: "1250.75",
    impressions: "45000",
    clicks: "980",
    inline_link_clicks: "612",
    reach: "21000",
    actions: [
      { action_type: "landing_page_view", value: "540" },
      { action_type: "omni_purchase", value: "34" },
      { action_type: "offsite_conversion.fb_pixel_purchase", value: "31" },
      { action_type: "omni_add_to_cart", value: "120" },
    ],
    action_values: [
      { action_type: "omni_purchase", value: "5321.40" },
      { action_type: "offsite_conversion.fb_pixel_purchase", value: "4980.10" },
    ],
    account_currency: "TRY",
    date_start: "2026-08-01",
    date_stop: "2026-08-21",
    campaign_id: "120210000000000001",
    campaign_name: "Test Kampanya",
    attribution_setting: "7d_click_1d_view",
    ...overrides,
  };
}

test("tek satır: alanlar doğru eşlenir, omni_purchase seçilir (çift sayım yok)", () => {
  const r = transformInsightsToResultDraft([baseRow()]);
  assert.ok(r.ok);
  const d = r.draft;
  assert.equal(d.periodStart, "2026-08-01");
  assert.equal(d.periodEnd, "2026-08-21");
  assert.equal(d.spend, 1250.75);
  assert.equal(d.impressions, 45000);
  // link tıklaması tercih edilir (CSV parser kararıyla aynı)
  assert.equal(d.clicks, 612);
  assert.equal(d.clicksSource, "Bağlantı tıklamaları (inline_link_clicks)");
  assert.equal(d.reach, 21000);
  // omni_purchase (34) seçilir; pixel purchase (31) ile TOPLANMAZ (65 değil!)
  assert.equal(d.purchases, 34);
  assert.equal(d.purchaseActionType, "omni_purchase");
  assert.equal(d.revenue, 5321.4);
  assert.equal(d.hasConversionData, true);
  assert.equal(d.currency, "TRY");
  assert.equal(d.attributionSetting, "7d_click_1d_view");
  assert.equal(d.campaignId, "120210000000000001");
});

test("inline_link_clicks yoksa clicks kullanılır + uyarı", () => {
  const r = transformInsightsToResultDraft([
    baseRow({ inline_link_clicks: undefined }),
  ]);
  assert.ok(r.ok);
  assert.equal(r.draft.clicks, 980);
  assert.equal(r.draft.clicksSource, "Tüm tıklamalar (clicks)");
  assert.ok(r.draft.warnings.some((w) => w.includes("tüm tıklamalar")));
});

test("omni_purchase yoksa pixel purchase kullanılır + kaynak uyarısı", () => {
  const r = transformInsightsToResultDraft([
    baseRow({
      actions: [
        { action_type: "offsite_conversion.fb_pixel_purchase", value: "31" },
      ],
      action_values: [
        { action_type: "offsite_conversion.fb_pixel_purchase", value: "4980.10" },
      ],
    }),
  ]);
  assert.ok(r.ok);
  assert.equal(r.draft.purchases, 31);
  assert.equal(r.draft.purchaseActionType, "offsite_conversion.fb_pixel_purchase");
  assert.equal(r.draft.revenue, 4980.1);
  assert.ok(r.draft.warnings.some((w) => w.includes("omni_purchase")));
});

test("satın alma yoksa: purchases/revenue null, 'conversion tracking' uyarısı, ROAS türetilmez", () => {
  const r = transformInsightsToResultDraft([
    baseRow({
      actions: [{ action_type: "landing_page_view", value: "540" }],
      action_values: undefined,
    }),
  ]);
  assert.ok(r.ok);
  assert.equal(r.draft.purchases, null);
  assert.equal(r.draft.revenue, null);
  assert.equal(r.draft.hasConversionData, false);
  assert.ok(r.draft.warnings.some((w) => w.includes("conversion tracking")));
});

test("satın alma var ama action_values yok: revenue null + uyarı (ROAS uydurulmaz)", () => {
  const r = transformInsightsToResultDraft([
    baseRow({ action_values: undefined }),
  ]);
  assert.ok(r.ok);
  assert.equal(r.draft.purchases, 34);
  assert.equal(r.draft.revenue, null);
  assert.ok(r.draft.warnings.some((w) => w.includes("ROAS")));
});

test("çok satır (günlük): toplamlar doğru, reach TOPLANMAZ (null + uyarı)", () => {
  const r = transformInsightsToResultDraft([
    baseRow({
      spend: "100.50",
      impressions: "1000",
      inline_link_clicks: "50",
      reach: "800",
      date_start: "2026-08-01",
      date_stop: "2026-08-01",
      actions: [{ action_type: "omni_purchase", value: "3" }],
      action_values: [{ action_type: "omni_purchase", value: "150.25" }],
    }),
    baseRow({
      spend: "200.25",
      impressions: "2000",
      inline_link_clicks: "70",
      reach: "900",
      date_start: "2026-08-02",
      date_stop: "2026-08-02",
      actions: [{ action_type: "omni_purchase", value: "5" }],
      action_values: [{ action_type: "omni_purchase", value: "250.50" }],
    }),
  ]);
  assert.ok(r.ok);
  const d = r.draft;
  assert.equal(d.spend, 300.75);
  assert.equal(d.impressions, 3000);
  assert.equal(d.clicks, 120);
  assert.equal(d.purchases, 8);
  assert.equal(d.revenue, 400.75);
  assert.equal(d.periodStart, "2026-08-01");
  assert.equal(d.periodEnd, "2026-08-02");
  // Erişim satırlardan toplanmaz — CSV parser'daki kararla birebir
  assert.equal(d.reach, null);
  assert.ok(d.warnings.some((w) => w.includes("Erişim")));
});

test("farklı campaign_id'ler tek sonuca toplanmaz (tek kampanya kuralı)", () => {
  const r = transformInsightsToResultDraft([
    baseRow({ campaign_id: "111" }),
    baseRow({ campaign_id: "222" }),
  ]);
  assert.ok(!r.ok);
  assert.ok(r.error.includes("farklı kampanya"));
});

test("boş data: dürüst hata (veri uydurulmaz)", () => {
  const r = transformInsightsToResultDraft([]);
  assert.ok(!r.ok);
  assert.ok(r.error.includes("veri döndürmedi"));
});

test("sıfır harcama: dürüst red (0.01 uydurulmaz — resultSchema spend>0 ister)", () => {
  const r = transformInsightsToResultDraft([
    baseRow({ spend: "0", actions: undefined, action_values: undefined }),
  ]);
  assert.ok(!r.ok);
  assert.ok(r.error.includes("0 harcama"));
});

test("bozuk sayı biçimi sessizce yutulmaz → hata", () => {
  const r = transformInsightsToResultDraft([baseRow({ spend: "12,50" })]);
  assert.ok(!r.ok);
  assert.ok(r.error.includes("spend"));
});

test("tarih yoksa sonuç dönemsiz kaydedilmez → hata", () => {
  const r = transformInsightsToResultDraft([
    baseRow({ date_start: undefined, date_stop: undefined }),
  ]);
  assert.ok(!r.ok);
  assert.ok(r.error.includes("date_start"));
});

test("sayılar number olarak da gelebilir (string zorunlu değil)", () => {
  const r = transformInsightsToResultDraft([
    baseRow({ spend: 99.5, impressions: 5000, inline_link_clicks: 100, reach: 4000 }),
  ]);
  assert.ok(r.ok);
  assert.equal(r.draft.spend, 99.5);
  assert.equal(r.draft.impressions, 5000);
});
