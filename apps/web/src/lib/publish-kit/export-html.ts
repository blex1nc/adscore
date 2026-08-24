// Yazdırılabilir kit (tek sayfa HTML, print CSS, tema bağımsız, logo yok).
// Kullanıcı tarayıcıdan "PDF olarak kaydet" ile alır. Saf fonksiyon: DOM/React yok.

import type { Kit, KitField } from "./types";

export type HtmlExportContext = {
  brandName: string;
  version: number;
  checklist: Record<string, boolean>;
  exportedAt: Date;
  publishedAt: Date | null;
  publishNote: string | null;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CONFIDENCE_TR: Record<string, string> = {
  low: "düşük",
  medium: "orta",
  high: "yüksek",
};

const SOURCE_TR: Record<KitField["source"], string> = {
  plan: "plan",
  creative: "creative",
  brand: "marka",
  user_input: "senin girdin",
};

function fieldRow(f: KitField): string {
  const value = f.value
    ? `<pre class="v">${escapeHtml(f.value)}</pre>`
    : `<span class="gap">— boş: Ads Manager'da sen belirle</span>`;
  const meta: string[] = [];
  if (f.confidence) meta.push(`güven: ${CONFIDENCE_TR[f.confidence] ?? f.confidence}`);
  meta.push(`kaynak: ${SOURCE_TR[f.source]}`);
  if (f.charLimit && f.value) {
    const n = [...f.value].length;
    meta.push(`${n} karakter · ${f.charLimitNote ?? "önerilen"} ${f.charLimit}${n > f.charLimit ? " — AŞIYOR" : ""}`);
  }
  return `<tr>
  <th scope="row"><div class="l">${escapeHtml(f.label)}</div><div class="p">${escapeHtml(f.adsManagerPath)}</div></th>
  <td>${value}
    ${f.why ? `<div class="why">Neden: ${escapeHtml(f.why)}</div>` : ""}
    ${f.alternative ? `<div class="why">Alternatif: ${escapeHtml(f.alternative)}</div>` : ""}
    ${f.note ? `<div class="note">${escapeHtml(f.note)}</div>` : ""}
    <div class="meta">${escapeHtml(meta.join(" · "))}</div>
  </td>
</tr>`;
}

export function renderKitHtml(kit: Kit, ctx: HtmlExportContext): string {
  const done = Object.keys(ctx.checklist).length;
  const total = kit.sections.reduce((n, s) => n + s.steps.length, 0);
  const campaignName =
    kit.sections[0]?.fields.find((f) => f.id === "campaign.name")?.value ?? "";

  const sections = kit.sections
    .map(
      (s, i) => `
<section>
  <h2>${i + 1}. ${escapeHtml(s.title)}</h2>
  <table>
    <tbody>${s.fields.map(fieldRow).join("")}</tbody>
  </table>
  <h3>Adımlar</h3>
  <ol class="steps">
    ${s.steps
      .map(
        (st) =>
          `<li><span class="box">${ctx.checklist[st.id] ? "☑" : "☐"}</span> ${escapeHtml(st.text)}</li>`,
      )
      .join("")}
  </ol>
</section>`,
    )
    .join("");

  const adsets = kit.adsets
    .map(
      (a, i) => `
<div class="adset">
  <h3>Reklam seti ${i + 1}: ${escapeHtml(a.name)}</h3>
  ${a.purpose ? `<p>${escapeHtml(a.purpose)}</p>` : ""}
  ${a.testVariable ? `<p class="note">Test değişkeni: ${escapeHtml(a.testVariable)}</p>` : ""}
  ${a.ads
    .map(
      (ad, j) => `
  <div class="ad">
    <h4>Reklam ${j + 1}: ${escapeHtml(ad.headline)}</h4>
    <dl>
      <dt>Birincil metin</dt><dd><pre class="v">${escapeHtml(ad.primaryText)}</pre></dd>
      <dt>Başlık</dt><dd>${escapeHtml(ad.headline)}</dd>
      ${ad.description ? `<dt>Açıklama</dt><dd>${escapeHtml(ad.description)}</dd>` : ""}
      <dt>CTA</dt><dd>${escapeHtml(ad.cta)}${ad.ctaButton ? ` (${escapeHtml(ad.ctaButton)})` : " — listeden elle seç"}</dd>
      <dt>Görsel</dt><dd>${ad.imageIds.length ? `${ad.imageIds.length} görsel (1:1 / 4:5 / 9:16 panelden indirilir)` : "yok — Creative Studio'da üret ya da kendi görselini yükle"}</dd>
    </dl>
  </div>`,
    )
    .join("")}
</div>`,
    )
    .join("");

  const budgetText = `${kit.budget.amount} ${kit.budget.currency} (${kit.budget.type === "DAILY" ? "günlük" : "toplam"})${kit.budget.durationDays ? ` · ${kit.budget.durationDays} gün` : ""}`;
  const scenarios = Array.isArray(kit.budget.scenarios)
    ? (kit.budget.scenarios as Array<{ name?: string; allocation?: string; note?: string }>)
    : [];

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(ctx.brandName)} — Ads Manager kurulum kiti v${ctx.version}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; font: 13px/1.5 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; background: #fff; max-width: 960px; margin-inline: auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 10px; padding-bottom: 4px; border-bottom: 1px solid #ccc; }
  h3 { font-size: 14px; margin: 18px 0 6px; }
  h4 { font-size: 13px; margin: 12px 0 4px; }
  .sub { color: #555; margin: 0 0 6px; }
  .disclaimer { border: 1px solid #999; padding: 10px 12px; margin: 14px 0; background: #f6f6f6; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: 8px 8px; border-bottom: 1px solid #e3e3e3; }
  th { width: 34%; font-weight: 600; }
  th .p { font-weight: 400; color: #666; font-size: 11px; }
  pre.v { margin: 0; white-space: pre-wrap; font: inherit; }
  .gap { color: #a33; }
  .why, .note { color: #555; font-size: 12px; margin-top: 3px; }
  .meta { color: #888; font-size: 11px; margin-top: 3px; }
  ol.steps { padding-left: 18px; }
  ol.steps li { margin: 3px 0; }
  .box { font-family: "Apple Color Emoji", "Segoe UI Symbol", sans-serif; }
  .adset { border: 1px solid #ddd; padding: 10px 14px; margin: 10px 0; }
  .ad { border-top: 1px dashed #ddd; padding-top: 6px; }
  dl { display: grid; grid-template-columns: 120px 1fr; gap: 2px 10px; margin: 0; }
  dt { color: #666; }
  dd { margin: 0; }
  ul.gaps { padding-left: 18px; }
  .scen { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .scen div { border: 1px solid #ddd; padding: 8px; }
  footer { margin-top: 28px; color: #777; font-size: 11px; }
  @media print {
    body { padding: 0; }
    section, .adset { break-inside: avoid; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(ctx.brandName)} — Ads Manager kurulum kiti</h1>
  <p class="sub">${escapeHtml(campaignName)} · Kit v${ctx.version} · üretildi ${escapeHtml(new Date(kit.generatedAt).toLocaleString("tr-TR"))} · dışa aktarıldı ${escapeHtml(ctx.exportedAt.toLocaleString("tr-TR"))}</p>
  <p class="sub">Bütçe: ${escapeHtml(budgetText)} · Checklist: ${done}/${total} adım${ctx.publishedAt ? ` · Ads Manager'da yayınlandı: ${escapeHtml(ctx.publishedAt.toLocaleString("tr-TR"))}${ctx.publishNote ? ` (${escapeHtml(ctx.publishNote)})` : ""}` : ""}</p>
  <div class="disclaimer">${escapeHtml(kit.disclaimer)} Bu kit performans tahmini içermez.</div>
</header>

${kit.gaps.length ? `<section><h2>Senin belirleyeceklerin (${kit.gaps.length})</h2><ul class="gaps">${kit.gaps.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul></section>` : ""}

${sections}

<section>
  <h2>Reklam setleri ve reklamlar</h2>
  ${adsets}
</section>

${scenarios.length ? `<section><h2>Bütçe senaryoları (senin bütçen üzerinden)</h2><div class="scen">${scenarios.map((s) => `<div><strong>${escapeHtml(s.name ?? "")}</strong><div>${escapeHtml(s.allocation ?? "")}</div>${s.note ? `<div class="note">${escapeHtml(s.note)}</div>` : ""}</div>`).join("")}</div></section>` : ""}

<footer>Alan adları ve limitler: ${escapeHtml(kit.meta.fieldsDoc)} (doğrulama ${escapeHtml(kit.meta.fieldsRetrievedAt)}). Meta menü adları zamanla değişebilir.</footer>
</body>
</html>`;
}
