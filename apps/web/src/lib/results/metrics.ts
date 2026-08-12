// Türetilmiş metrikler HER ZAMAN koddan hesaplanır; AI'a hazır verilir.
// Payda yoksa metrik null döner ve UI "-" gösterir (sayı uydurulmaz).

export type ResultInput = {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number | null;
  purchases: number | null;
  revenue: number | null;
};

export type ComputedMetrics = {
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cvr: number | null;
  cpa: number | null;
  roas: number | null;
  frequency: number | null;
};

export function computeMetrics(r: ResultInput): ComputedMetrics {
  const safe = (n: number) => (Number.isFinite(n) ? n : null);
  return {
    ctr: r.impressions > 0 ? safe((r.clicks / r.impressions) * 100) : null,
    cpc: r.clicks > 0 ? safe(r.spend / r.clicks) : null,
    cpm: r.impressions > 0 ? safe((r.spend / r.impressions) * 1000) : null,
    cvr:
      r.purchases != null && r.clicks > 0
        ? safe((r.purchases / r.clicks) * 100)
        : null,
    cpa:
      r.purchases != null && r.purchases > 0
        ? safe(r.spend / r.purchases)
        : null,
    roas:
      r.revenue != null && r.spend > 0 ? safe(r.revenue / r.spend) : null,
    frequency:
      r.reach != null && r.reach > 0
        ? safe(r.impressions / r.reach)
        : null,
  };
}

export function formatMetric(
  value: number | null,
  digits = 2,
  suffix = "",
): string {
  if (value == null) return "-";
  return `${value.toFixed(digits)}${suffix}`;
}

// CLAUDE.md §28 — yetersiz veride analiz koşulmaz
export const MIN_IMPRESSIONS_FOR_ANALYSIS = 1000;
export const MIN_CLICKS_FOR_ANALYSIS = 20;
