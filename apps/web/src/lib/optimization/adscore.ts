// AdScore — markanın KENDİ geçmişine göre göreli performans skoru.
// Sektör benchmark'ı YOK (CLAUDE.md §6): kıyas yalnız aynı markanın yeterli-veri
// sonuçları arasında yapılır. 50 = marka medyanı. Tamamen deterministik; AI'sız.

import {
  type ComputedMetrics,
  MIN_CLICKS_FOR_ANALYSIS,
  MIN_IMPRESSIONS_FOR_ANALYSIS,
} from "@/lib/results/metrics";

export type ScoreableResult = {
  id: string;
  planId: string;
  periodStart: Date;
  periodEnd: Date;
  impressions: number;
  clicks: number;
  metrics: ComputedMetrics;
};

export type ScoreMetricKey = "ctr" | "cpc" | "cvr" | "cpa" | "roas";

// true = yüksek iyi, false = düşük iyi
const METRIC_DIRECTION: Record<ScoreMetricKey, boolean> = {
  ctr: true,
  cpc: false,
  cvr: true,
  cpa: false,
  roas: true,
};

export const SCORE_METRIC_LABELS: Record<ScoreMetricKey, string> = {
  ctr: "CTR",
  cpc: "CPC",
  cvr: "CVR",
  cpa: "CPA",
  roas: "ROAS",
};

// Dönüşüm metrikleri girilmişse skora daha çok etki eder: tıklama ucuz sinyal,
// satış gerçek sonuçtur. Ağırlıklar yalnız MEVCUT bileşenler arasında normalize edilir.
const METRIC_WEIGHTS: Record<ScoreMetricKey, number> = {
  ctr: 1,
  cpc: 1,
  cvr: 2,
  cpa: 2,
  roas: 3,
};

export type ComponentScore = {
  metric: ScoreMetricKey;
  value: number;
  brandMedian: number;
  comparisonCount: number;
  score: number; // 0-100; 50 = marka medyanı
};

export type AdScore =
  | { eligible: false; reason: string }
  | {
      eligible: true;
      score: number;
      components: ComponentScore[];
      missingMetrics: ScoreMetricKey[];
      comparisonCount: number;
      coverageNote: string;
    };

export const MIN_RESULTS_FOR_SCORE = 2;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function isEligibleForScore(r: ScoreableResult): boolean {
  return (
    r.impressions >= MIN_IMPRESSIONS_FOR_ANALYSIS &&
    r.clicks >= MIN_CLICKS_FOR_ANALYSIS
  );
}

// Tek bileşen skoru: medyana oran 0-100 aralığına eşlenir (medyan = 50,
// medyanın 2 katı kadar iyi = 100). Düşük-iyi metriklerde oran ters çevrilir.
function componentScore(
  metric: ScoreMetricKey,
  value: number,
  brandMedian: number,
): number | null {
  if (brandMedian <= 0) return null;
  if (!METRIC_DIRECTION[metric] && value <= 0) return null;
  const ratio = METRIC_DIRECTION[metric]
    ? value / brandMedian
    : brandMedian / value;
  return Math.round(clamp(50 * ratio, 0, 100));
}

// Markanın tüm sonuçları için skor haritası üretir. Her sonuç, DİĞER
// yeterli-veri sonuçlarının medyanıyla kıyaslanır (kendisi medyana dahil edilmez).
export function computeBrandScores(
  results: ScoreableResult[],
): Map<string, AdScore> {
  const eligible = results.filter(isEligibleForScore);
  const scores = new Map<string, AdScore>();

  for (const r of results) {
    if (!isEligibleForScore(r)) {
      scores.set(r.id, {
        eligible: false,
        reason: `Insufficient Data: skor için en az ${MIN_IMPRESSIONS_FOR_ANALYSIS} gösterim ve ${MIN_CLICKS_FOR_ANALYSIS} tıklama gerekir (bu sonuç: ${r.impressions} gösterim / ${r.clicks} tıklama).`,
      });
      continue;
    }
    const others = eligible.filter((o) => o.id !== r.id);
    if (others.length < MIN_RESULTS_FOR_SCORE - 1) {
      scores.set(r.id, {
        eligible: false,
        reason: `Kıyas için markada yeterli veriye sahip en az ${MIN_RESULTS_FOR_SCORE} sonuç gerekir; şu an tek sonuç var. Skor göreli hesaplanır, tek sonuçla kıyas yapılamaz.`,
      });
      continue;
    }

    const components: ComponentScore[] = [];
    const missingMetrics: ScoreMetricKey[] = [];
    for (const metric of Object.keys(METRIC_DIRECTION) as ScoreMetricKey[]) {
      const value = r.metrics[metric];
      const otherValues = others
        .map((o) => o.metrics[metric])
        .filter((v): v is number => v != null);
      if (value == null || otherValues.length === 0) {
        missingMetrics.push(metric);
        continue;
      }
      const brandMedian = median(otherValues);
      const score = componentScore(metric, value, brandMedian);
      if (score == null) {
        missingMetrics.push(metric);
        continue;
      }
      components.push({
        metric,
        value,
        brandMedian,
        comparisonCount: otherValues.length,
        score,
      });
    }

    if (components.length === 0) {
      scores.set(r.id, {
        eligible: false,
        reason:
          "Bu sonuçla diğer sonuçlar arasında kıyaslanabilir ortak metrik yok.",
      });
      continue;
    }

    const totalWeight = components.reduce(
      (sum, c) => sum + METRIC_WEIGHTS[c.metric],
      0,
    );
    const overall = Math.round(
      components.reduce(
        (sum, c) => sum + c.score * METRIC_WEIGHTS[c.metric],
        0,
      ) / totalWeight,
    );

    const notes: string[] = [
      `Kıyas: bu markanın ${others.length} diğer yeterli-veri sonucu (sektör benchmark'ı değil).`,
    ];
    const conversionMissing = missingMetrics.filter((m) =>
      ["cvr", "cpa", "roas"].includes(m),
    );
    if (conversionMissing.length > 0) {
      notes.push(
        `Dönüşüm verisi eksik olduğu için skora girmeyen metrikler: ${conversionMissing
          .map((m) => SCORE_METRIC_LABELS[m])
          .join(", ")}.`,
      );
    }
    if (others.length < 3) {
      notes.push("Küçük örneklem: skor dalgalı olabilir, kesin sıralama sayma.");
    }

    scores.set(r.id, {
      eligible: true,
      score: overall,
      components,
      missingMetrics,
      comparisonCount: others.length,
      coverageNote: notes.join(" "),
    });
  }
  return scores;
}
