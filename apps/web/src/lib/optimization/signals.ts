// Gözlenen sinyaller — aynı kampanya planının ardışık dönem sonuçları arasındaki
// GERÇEK değişimler. Eşikler pratik kural niteliğindedir ve çıktıda gerçek sayılar
// verilir; "neden" yorumu koda değil AI teşhisine bırakılır (observed ≠ hypothesis).

import { formatMetric } from "@/lib/results/metrics";
import { isEligibleForScore, type ScoreableResult } from "./adscore";

export type SignalKind =
  | "creative_fatigue"
  | "ctr_drop"
  | "cpa_rise"
  | "roas_drop";

export const SIGNAL_LABELS: Record<SignalKind, string> = {
  creative_fatigue: "Creative yorgunluğu sinyali",
  ctr_drop: "CTR düşüşü",
  cpa_rise: "CPA artışı",
  roas_drop: "ROAS düşüşü",
};

export type Signal = {
  planId: string;
  kind: SignalKind;
  observation: string; // gerçek sayılarla gözlem
  evidence: string; // hangi dönemler kıyaslandı
};

// Değişim eşikleri (oransal). Küçük dalgalanmalar sinyal sayılmaz.
export const CHANGE_THRESHOLD = 0.2; // %20
export const FATIGUE_CTR_DROP = 0.15; // %15 CTR düşüşü
export const FATIGUE_FREQUENCY_RISE = 0.1; // %10 frekans artışı

function relChange(prev: number, last: number): number | null {
  if (prev <= 0) return null;
  return (last - prev) / prev;
}

function pct(change: number): string {
  return `${change > 0 ? "+" : ""}${Math.round(change * 100)}%`;
}

function periodLabel(r: ScoreableResult): string {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `${fmt(r.periodStart)}–${fmt(r.periodEnd)}`;
}

// Plan başına: kronolojik son iki dönem kıyaslanır (önceki dönem vs son dönem).
// Yetersiz-veri dönemleri kıyasa alınmaz (CLAUDE.md §28 — küçük örneklem gürültüsü).
export function detectSignals(
  plans: Array<{ id: string; results: ScoreableResult[] }>,
): Signal[] {
  const signals: Signal[] = [];

  for (const plan of plans) {
    const ordered = plan.results
      .filter(isEligibleForScore)
      .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
    if (ordered.length < 2) continue;
    const prev = ordered[ordered.length - 2];
    const last = ordered[ordered.length - 1];
    const evidence = `Kıyaslanan dönemler: ${periodLabel(prev)} → ${periodLabel(last)}.`;

    const ctrChange =
      prev.metrics.ctr != null && last.metrics.ctr != null
        ? relChange(prev.metrics.ctr, last.metrics.ctr)
        : null;
    const freqChange =
      prev.metrics.frequency != null && last.metrics.frequency != null
        ? relChange(prev.metrics.frequency, last.metrics.frequency)
        : null;
    const cpaChange =
      prev.metrics.cpa != null && last.metrics.cpa != null
        ? relChange(prev.metrics.cpa, last.metrics.cpa)
        : null;
    const roasChange =
      prev.metrics.roas != null && last.metrics.roas != null
        ? relChange(prev.metrics.roas, last.metrics.roas)
        : null;

    if (
      ctrChange != null &&
      freqChange != null &&
      ctrChange <= -FATIGUE_CTR_DROP &&
      freqChange >= FATIGUE_FREQUENCY_RISE
    ) {
      signals.push({
        planId: plan.id,
        kind: "creative_fatigue",
        observation: `Frekans ${formatMetric(prev.metrics.frequency)} → ${formatMetric(last.metrics.frequency)} (${pct(freqChange)}) yükselirken CTR ${formatMetric(prev.metrics.ctr, 2, "%")} → ${formatMetric(last.metrics.ctr, 2, "%")} (${pct(ctrChange)}) düştü.`,
        evidence,
      });
    } else if (ctrChange != null && ctrChange <= -CHANGE_THRESHOLD) {
      signals.push({
        planId: plan.id,
        kind: "ctr_drop",
        observation: `CTR ${formatMetric(prev.metrics.ctr, 2, "%")} → ${formatMetric(last.metrics.ctr, 2, "%")} (${pct(ctrChange)}).`,
        evidence,
      });
    }

    if (cpaChange != null && cpaChange >= CHANGE_THRESHOLD) {
      signals.push({
        planId: plan.id,
        kind: "cpa_rise",
        observation: `CPA ${formatMetric(prev.metrics.cpa)} → ${formatMetric(last.metrics.cpa)} (${pct(cpaChange)}).`,
        evidence,
      });
    }
    if (roasChange != null && roasChange <= -CHANGE_THRESHOLD) {
      signals.push({
        planId: plan.id,
        kind: "roas_drop",
        observation: `ROAS ${formatMetric(prev.metrics.roas)} → ${formatMetric(last.metrics.roas)} (${pct(roasChange)}).`,
        evidence,
      });
    }
  }
  return signals;
}
