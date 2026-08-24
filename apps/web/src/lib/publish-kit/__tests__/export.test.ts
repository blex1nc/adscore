// Dışa aktarma saf fonksiyon testleri (HTML + CSV).
// Koşturma: apps/web dizininde
//   ../../packages/db/node_modules/.bin/tsx --test src/lib/publish-kit/__tests__/export.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildKit } from "../build";
import { renderKitHtml, escapeHtml } from "../export-html";
import { renderKitSheet, SHEET_COLUMNS } from "../export-sheet";
import type { PlanResultShape } from "../types";

const here = dirname(fileURLToPath(import.meta.url));
const OLD_PLAN: PlanResultShape = JSON.parse(
  readFileSync(join(here, "fixture-plan-old.json"), "utf8"),
);

const kit = buildKit({
  plan: {
    id: "p",
    status: "COMPLETED",
    goal: "SALES",
    budgetType: "DAILY",
    budgetAmount: "500.00",
    currency: "TRY",
    durationDays: 14,
    result: OLD_PLAN,
  },
  creatives: [
    {
      id: "c1",
      approval: "APPROVED",
      headline: "Damak Tadınıza Uygun Kahveyi Keşfedin",
      primaryText: 'Satır 1\n"Tırnaklı" satır, virgül, <b>etiket</b>',
      description: null,
      cta: "Hemen Keşfet",
      images: [{ id: "img1", status: "COMPLETED", hasData: true }],
    },
    {
      id: "c2",
      approval: "APPROVED",
      headline: "Damak Tadına Göre Kahve Keşfi",
      primaryText: "İkinci metin",
      description: "Açıklama",
      cta: "Alışverişe Başla",
      images: [],
    },
  ],
  brand: {
    name: "Örnek Kahve",
    website: "https://www.kronotrop.com.tr",
    currency: "TRY",
    targetMarket: "TR",
    copyLanguage: "tr",
  },
  inputs: { facebookPage: "Örnek Kahve" },
  now: new Date("2026-08-23T12:00:00.000Z"),
});

test("HTML export: değerler kaçışlı, checklist durumu ve uyarı metni var, logo yok", () => {
  const html = renderKitHtml(kit, {
    brandName: "Örnek Kahve",
    version: 2,
    checklist: { "campaign.objective": true },
    exportedAt: new Date("2026-08-23T13:00:00.000Z"),
    publishedAt: null,
    publishNote: null,
  });
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /kurulum kiti v2/);
  assert.ok(html.includes("&lt;b&gt;etiket&lt;/b&gt;"), "HTML kaçışı");
  assert.ok(!html.includes("<b>etiket</b>"));
  assert.match(html, /☑/); // işaretli adım
  assert.match(html, /☐/); // işaretsiz adım
  assert.match(html, /Bütçe ve harcama tamamen senin kontrolünde/);
  assert.match(html, /@media print/);
  assert.doesNotMatch(html, /<img/); // logo/görsel yok
  assert.equal(escapeHtml(`a&b<c>"d'`), "a&amp;b&lt;c&gt;&quot;d&#39;");
});

test("CSV export: dokümante sütunlar, güvenli durumlar, tırnak kaçışı, BOM", () => {
  const csv = renderKitSheet(kit, { brandName: "Örnek Kahve", countryCode: "TR" });
  assert.ok(csv.startsWith("﻿"), "UTF-8 BOM");
  const lines = csv.replace(/^﻿/, "").trimEnd().split("\r\n");
  assert.equal(lines.length, 3); // başlık + 2 reklam
  assert.equal(lines[0], SHEET_COLUMNS.map((c) => `"${c}"`).join(","));

  const cols = SHEET_COLUMNS as readonly string[];
  const parse = (line: string) =>
    line.match(/"((?:[^"]|"")*)"/g)!.map((x) => x.slice(1, -1).replace(/""/g, '"'));
  const row1 = Object.fromEntries(parse(lines[1]).map((v, i) => [cols[i], v]));
  const row2 = Object.fromEntries(parse(lines[2]).map((v, i) => [cols[i], v]));

  assert.equal(row1["Campaign Status"], "Paused");
  assert.equal(row1["Ad Set Status"], "Paused");
  assert.equal(row1["Ad Status"], "Off");
  assert.equal(row1["Campaign Objective"], "Sales");
  assert.equal(row1["Countries"], "TR");
  assert.equal(row1["Age Min"], "22");
  assert.equal(row1["Age Max"], "48");
  assert.equal(row1["Gender"], ""); // tüm cinsiyetler → boş (dokümana göre)
  assert.equal(row1["Ad Set Daily Budget"], "500.00");
  assert.equal(row1["Ad Set Lifetime Budget"], "");
  assert.equal(row1["Optimization Goal"], ""); // belirlenemeyen zorunlu sütun boş
  assert.equal(row1["Body"], 'Satır 1\n"Tırnaklı" satır, virgül, <b>etiket</b>');
  assert.equal(row1["Title"], "Damak Tadınıza Uygun Kahveyi Keşfedin");
  assert.equal(row1["Link"], "https://www.kronotrop.com.tr");
  assert.equal(row1["Image"], "ornek-kahve-damak-tadiniza-uygun-kahveyi-kesfedin-1x1.jpg");
  assert.equal(row1["Call to action"], "LEARN_MORE"); // yaklaşık eşleşme, dokümante değer
  assert.equal(row2["Image"], ""); // görselsiz creative
  assert.equal(row2["Call to action"], "SHOP_NOW");
  assert.equal(row2["Link Description"], "Açıklama");
});
