// Ads Manager rapor export'undan (CSV) sonuç içe aktarma — Meta API'siz meşru yol.
// Kullanıcı Ads Manager'dan raporu kendisi export eder; burada yalnız parse edilir.
// Hiçbir değer uydurulmaz: bulunamayan kolon "yok" sayılır, belirsizlikler warning olur
// ve kayıt ancak kullanıcı önizlemeyi onaylayınca yapılır.

export type CsvImportPreview = {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number | null;
  purchases: number | null;
  revenue: number | null;
  rowCount: number;
  campaignName: string | null;
  clicksSource: string;
  warnings: string[];
};

export type CsvImportResult =
  | { ok: true; preview: CsvImportPreview }
  | { ok: false; error: string };

// --- CSV satır ayrıştırma (tırnak destekli, bağımlılıksız) ---

function detectDelimiter(headerLine: string): string {
  const counts: Array<[string, number]> = [";", ",", "\t"].map((d) => [
    d,
    headerLine.split(d).length - 1,
  ]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = clean.slice(0, clean.indexOf("\n") + 1 || undefined);
  const delim = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

// --- Başlık eşleme (TR + EN Ads Manager kolon adları) ---

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

type ColumnKey =
  | "periodStart"
  | "periodEnd"
  | "day"
  | "spend"
  | "impressions"
  | "linkClicks"
  | "allClicks"
  | "reach"
  | "purchases"
  | "revenue"
  | "campaignName";

// exact: tam eşleşme; prefix: başlıkla başlama (ör. "amount spent (try)")
const HEADER_MATCHERS: Array<{
  key: ColumnKey;
  exact?: string[];
  prefix?: string[];
}> = [
  {
    key: "periodStart",
    exact: [
      "reporting starts",
      "raporlama başlangıcı",
      "raporlama baslangici",
      "start date",
      "başlangıç tarihi",
    ],
  },
  {
    key: "periodEnd",
    exact: [
      "reporting ends",
      "raporlama bitişi",
      "raporlama bitisi",
      "end date",
      "bitiş tarihi",
    ],
  },
  { key: "day", exact: ["day", "gün", "gun", "date", "tarih"] },
  {
    key: "spend",
    prefix: ["amount spent", "harcanan tutar", "spend", "harcama"],
  },
  {
    key: "impressions",
    exact: ["impressions", "gösterimler", "gosterimler", "gösterim", "gosterim"],
  },
  {
    key: "linkClicks",
    exact: [
      "link clicks",
      "bağlantı tıklamaları",
      "baglanti tiklamalari",
      "unique link clicks",
    ],
  },
  {
    key: "allClicks",
    exact: [
      "clicks (all)",
      "tıklamalar (tümü)",
      "tiklamalar (tumu)",
      "clicks",
      "tıklamalar",
      "tiklamalar",
    ],
  },
  { key: "reach", exact: ["reach", "erişim", "erisim"] },
  {
    key: "purchases",
    exact: [
      "purchases",
      "satın almalar",
      "satin almalar",
      "website purchases",
      "web sitesi satın almaları",
      "web sitesi satin almalari",
      "purchase",
    ],
  },
  {
    key: "revenue",
    prefix: [
      "purchases conversion value",
      "purchase conversion value",
      "website purchases conversion value",
      "satın alma dönüşüm değeri",
      "satin alma donusum degeri",
      "satın almalar dönüşüm değeri",
    ],
  },
  {
    key: "campaignName",
    exact: ["campaign name", "kampanya adı", "kampanya adi"],
  },
];

function mapHeaders(headers: string[]): Map<ColumnKey, number> {
  const map = new Map<ColumnKey, number>();
  headers.forEach((raw, idx) => {
    const h = normalizeHeader(raw);
    for (const m of HEADER_MATCHERS) {
      if (map.has(m.key)) continue;
      if (m.exact?.includes(h)) map.set(m.key, idx);
      else if (m.prefix?.some((p) => h.startsWith(p))) map.set(m.key, idx);
    }
  });
  return map;
}

// --- Sayı ve tarih ayrıştırma (TR "3.500,75" ve EN "3,500.75") ---

function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim().replace(/[^\d.,-]/g, "");
  if (s === "" || s === "-") return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot !== -1 && lastComma !== -1) {
    // İki ayraç da varsa sondaki ondalıktır, diğeri binliktir
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const after = s.length - lastComma - 1;
    // 1-2 hane → ondalık virgül (TR); 3 hane → binlik
    if (after > 0 && after <= 2) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastDot !== -1) {
    const after = s.length - lastDot - 1;
    if (!(after > 0 && after <= 2)) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) {
    // TR export'ları GG.AA.YYYY kullanır
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

// --- Ana içe aktarma ---

export const CSV_MAX_BYTES = 1_000_000;

export function parseAdsManagerCsv(text: string): CsvImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return {
      ok: false,
      error:
        "Dosyada başlık satırı dışında veri satırı yok. Ads Manager'dan CSV olarak export edilmiş bir rapor yükle.",
    };
  }
  const headers = rows[0];
  const col = mapHeaders(headers);
  const dataRows = rows.slice(1);
  const warnings: string[] = [];

  const missing: string[] = [];
  if (!col.has("spend")) missing.push("Harcanan Tutar / Amount spent");
  if (!col.has("impressions")) missing.push("Gösterimler / Impressions");
  if (!col.has("linkClicks") && !col.has("allClicks"))
    missing.push("Bağlantı tıklamaları / Link clicks");
  const hasDates =
    (col.has("periodStart") && col.has("periodEnd")) || col.has("day");
  if (!hasDates)
    missing.push("Raporlama başlangıcı+bitişi / Reporting starts+ends (veya Gün)");
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Gerekli kolonlar bulunamadı: ${missing.join(" · ")}. Dosyadaki kolonlar: ${headers
        .map((h) => h.trim())
        .filter(Boolean)
        .join(", ")}. Ads Manager export'unda bu kolonların seçili olduğundan emin ol.`,
    };
  }

  // Tek kampanya kuralı: farklı kampanyaların satırları tek sonuca toplanamaz
  if (col.has("campaignName")) {
    const names = new Set(
      dataRows
        .map((r) => r[col.get("campaignName")!]?.trim())
        .filter((n) => n),
    );
    if (names.size > 1) {
      return {
        ok: false,
        error: `Dosyada ${names.size} farklı kampanya var (${[...names]
          .slice(0, 3)
          .join(", ")}...). Tek sonuca toplanamaz; raporu tek kampanya için export et.`,
      };
    }
  }

  const clicksKey: ColumnKey = col.has("linkClicks") ? "linkClicks" : "allClicks";
  const clicksSource =
    clicksKey === "linkClicks"
      ? "Bağlantı tıklamaları (link clicks)"
      : "Tüm tıklamalar (clicks all) — bağlantı tıklaması kolonu dosyada yoktu";
  if (clicksKey === "allClicks") {
    warnings.push(
      "Tıklama olarak 'Tüm tıklamalar' kullanıldı; bağlantı tıklamasından yüksek çıkabilir. Daha doğru CTR için export'a 'Bağlantı tıklamaları' kolonunu ekle.",
    );
  }

  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let reachSum = 0;
  let reachSeen = false;
  let purchases = 0;
  let purchasesSeen = false;
  let revenue = 0;
  let revenueSeen = false;
  const dates: string[] = [];
  let skippedRows = 0;

  for (const r of dataRows) {
    const rowSpend = parseNumber(r[col.get("spend")!]);
    const rowImp = parseNumber(r[col.get("impressions")!]);
    const rowClicks = parseNumber(r[col.get(clicksKey)!]);
    if (rowSpend == null && rowImp == null && rowClicks == null) {
      skippedRows++;
      continue;
    }
    spend += rowSpend ?? 0;
    impressions += Math.round(rowImp ?? 0);
    clicks += Math.round(rowClicks ?? 0);
    if (col.has("reach")) {
      const v = parseNumber(r[col.get("reach")!]);
      if (v != null) {
        reachSum += Math.round(v);
        reachSeen = true;
      }
    }
    if (col.has("purchases")) {
      const v = parseNumber(r[col.get("purchases")!]);
      if (v != null) {
        purchases += Math.round(v);
        purchasesSeen = true;
      }
    }
    if (col.has("revenue")) {
      const v = parseNumber(r[col.get("revenue")!]);
      if (v != null) {
        revenue += v;
        revenueSeen = true;
      }
    }
    if (col.has("periodStart")) {
      const d = parseDate(r[col.get("periodStart")!]);
      if (d) dates.push(d);
    }
    if (col.has("periodEnd")) {
      const d = parseDate(r[col.get("periodEnd")!]);
      if (d) dates.push(d);
    }
    if (col.has("day")) {
      const d = parseDate(r[col.get("day")!]);
      if (d) dates.push(d);
    }
  }

  const usedRows = dataRows.length - skippedRows;
  if (usedRows === 0 || (spend === 0 && impressions === 0)) {
    return {
      ok: false,
      error: "Dosyadan kullanılabilir sayısal veri okunamadı.",
    };
  }
  if (skippedRows > 0) {
    warnings.push(`${skippedRows} boş/sayısız satır atlandı.`);
  }
  if (dates.length === 0) {
    return {
      ok: false,
      error:
        "Tarih kolonları bulundu ama hiçbir satırda tarih okunamadı. Beklenen formatlar: YYYY-AA-GG veya GG.AA.YYYY.",
    };
  }

  dates.sort();
  const periodStart = dates[0];
  const periodEnd = dates[dates.length - 1];

  // Erişim kişi bazlıdır, günlük satırlardan TOPLANAMAZ (kişiler örtüşür).
  let reach: number | null = null;
  if (reachSeen) {
    if (usedRows === 1) reach = reachSum;
    else
      warnings.push(
        "Erişim birden çok satırdan toplanamaz (aynı kişiler örtüşür); boş bırakıldı. Dönemin gerçek erişimi için Ads Manager'da tek satırlık (breakdown'suz) export al.",
      );
  }

  return {
    ok: true,
    preview: {
      periodStart,
      periodEnd,
      spend: Math.round(spend * 100) / 100,
      impressions,
      clicks,
      reach,
      purchases: purchasesSeen ? purchases : null,
      revenue: revenueSeen ? Math.round(revenue * 100) / 100 : null,
      rowCount: usedRows,
      campaignName: col.has("campaignName")
        ? (dataRows[0][col.get("campaignName")!]?.trim() ?? null)
        : null,
      clicksSource,
      warnings,
    },
  };
}
