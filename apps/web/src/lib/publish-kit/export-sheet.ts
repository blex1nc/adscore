// Ads Manager "Import ads in bulk" için CSV (docs/META-ADS-MANAGER-FIELDS.md §6).
// Sütun adları Meta'nın resmi "Columns in the import/export template" makalesinden;
// şablon dosyasının kendisi giriş gerektirdiğinden BİREBİR doğrulanamadı — UI'da uyarı var.
// Güvenlik: kampanya/reklam seti Paused, reklam Off → içe aktarım harcama BAŞLATMAZ.
// Belirlenemeyen zorunlu sütunlar (Optimization Goal, Billing Event, Link Object ID) BOŞ
// bırakılır; uydurma değer yok. Saf fonksiyon.

import { OBJECTIVES, SHEET_CTA_VALUES } from "./meta-fields";
import { slugify } from "./build";
import type { Kit } from "./types";

export const SHEET_COLUMNS = [
  "Campaign ID",
  "Campaign Name",
  "Campaign Objective",
  "Campaign Status",
  "Buying Type",
  "Campaign Spend Limit",
  "Ad Set ID",
  "Ad Set Name",
  "Ad Set Status",
  "Ad Set Daily Budget",
  "Ad Set Lifetime Budget",
  "Ad Set Time Start",
  "Countries",
  "Age Min",
  "Age Max",
  "Gender",
  "Optimization Goal",
  "Billing Event",
  "Link Object ID",
  "Ad ID",
  "Ad Name",
  "Ad Status",
  "Creative Type",
  "Body",
  "Title",
  "Link Description",
  "Link",
  "Display Link",
  "Image",
  "Image Hash",
  "Call to action",
  "URL Tags",
] as const;

type Row = Record<(typeof SHEET_COLUMNS)[number], string>;

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

function findField(kit: Kit, id: string): string {
  for (const s of kit.sections) {
    const f = s.fields.find((x) => x.id === id);
    if (f) return f.value;
  }
  return "";
}

export type SheetExportContext = { brandName: string; countryCode: string | null };

export function renderKitSheet(kit: Kit, ctx: SheetExportContext): string {
  const campaignName = findField(kit, "campaign.name").slice(0, 35);
  const objectiveValue = findField(kit, "campaign.objective");
  const objective = OBJECTIVES.find(
    (o) => o.labelTr === objectiveValue || o.labelEn === objectiveValue,
  );
  const singleAdset = kit.adsets.length === 1;
  const rows: Row[] = [];

  kit.adsets.forEach((a, i) => {
    const p = `adset.${i}`;
    const age = findField(kit, `${p}.age`).match(/^(\d{2})-(\d{2})/);
    const genderValue = findField(kit, `${p}.gender`);
    const countries = findField(kit, `${p}.locations`);
    // Yalnız ISO ülke kodu geçerli (dokümanda "ISO country code"); serbest metin boş kalır
    const countryIso =
      /^[A-Z]{2}$/.test(countries.trim()) ? countries.trim() : (ctx.countryCode ?? "");
    const dailyBudget =
      kit.budget.type === "DAILY" && singleAdset ? kit.budget.amount : "";
    const lifetimeBudget =
      kit.budget.type === "LIFETIME" && singleAdset ? kit.budget.amount : "";

    a.ads.forEach((ad) => {
      const imageName = ad.imageIds.length
        ? `${slugify(ctx.brandName)}-${slugify(ad.headline)}-1x1.jpg`
        : "";
      rows.push({
        "Campaign ID": "",
        "Campaign Name": campaignName,
        "Campaign Objective": objective?.sheetLabel ?? "",
        "Campaign Status": "Paused",
        "Buying Type": "Auction",
        "Campaign Spend Limit": "",
        "Ad Set ID": "",
        "Ad Set Name": a.name.slice(0, 35),
        "Ad Set Status": "Paused",
        "Ad Set Daily Budget": dailyBudget,
        "Ad Set Lifetime Budget": lifetimeBudget,
        "Ad Set Time Start": "",
        Countries: countryIso,
        "Age Min": age?.[1] ?? "",
        "Age Max": age?.[2] ?? "",
        Gender: genderValue === "Erkekler" ? "Men" : genderValue === "Kadınlar" ? "women" : "",
        "Optimization Goal": "",
        "Billing Event": "",
        "Link Object ID": "",
        "Ad ID": "",
        "Ad Name": `${slugify(ad.headline, 30)}`.slice(0, 35),
        "Ad Status": "Off",
        "Creative Type": "Page post ad",
        Body: ad.primaryText,
        Title: ad.headline,
        "Link Description": ad.description ?? "",
        Link: findField(kit, "ad.destination_url"),
        "Display Link": "",
        Image: imageName,
        "Image Hash": "",
        "Call to action":
          ad.ctaButton && (SHEET_CTA_VALUES as readonly string[]).includes(ad.ctaButton)
            ? ad.ctaButton
            : "",
        "URL Tags": "",
      });
    });
  });

  const header = SHEET_COLUMNS.map(csvCell).join(",");
  const body = rows
    .map((r) => SHEET_COLUMNS.map((c) => csvCell(r[c] ?? "")).join(","))
    .join("\r\n");
  // BOM: Excel'in UTF-8 (Türkçe karakter) tanıması için
  return `﻿${header}\r\n${body}\r\n`;
}
