// ARENA — skor birleştirme, Borda, seçilim, yakınsama (AGENT-A §5). SAF FONKSİYON.
//
// KIRMIZI ÇİZGİ: Buradaki her skor adaylar arası GÖRELİ sıralamadır; performans
// tahmini (CTR/CPC/ROAS/erişim) DEĞİLDİR ve üretilmez (CLAUDE.md §6/§31).

export const JUDGE_DIMENSIONS = [
  "attention",
  "clarity",
  "brand_fit",
  "audience_fit",
] as const;
export type JudgeDimension = (typeof JUDGE_DIMENSIONS)[number];
export type JudgeWeights = Record<JudgeDimension, number>;

export const JUDGE_DIMENSION_LABELS: Record<JudgeDimension, string> = {
  attention: "Dikkat",
  clarity: "Netlik",
  brand_fit: "Marka uyumu",
  audience_fit: "Kitle uyumu",
};

/** Jüri personaları — her biri aynı 4 boyutu puanlar, ağırlığı farklı (AGENT-A §5). */
export type JudgePersona = {
  key: string;
  label: string;
  weights: JudgeWeights;
};
export const JUDGE_PERSONAS: JudgePersona[] = [
  {
    key: "scroll_stopper",
    label: "Scroll-stopper",
    weights: { attention: 2, clarity: 1, brand_fit: 1, audience_fit: 1 },
  },
  {
    key: "brand_strategist",
    label: "Marka stratejisti",
    weights: { attention: 1, clarity: 1, brand_fit: 2, audience_fit: 1 },
  },
  {
    key: "media_buyer",
    label: "Performans medya alıcısı",
    weights: { attention: 1, clarity: 2, brand_fit: 1, audience_fit: 1 },
  },
  {
    key: "audience_rep",
    label: "Hedef kitle temsilcisi",
    weights: { attention: 1, clarity: 1, brand_fit: 1, audience_fit: 2 },
  },
];

/** Bir jürinin tek aday için verdiği puanlar (1-10) + eleştiri */
export type JudgeCandidateVerdict = {
  attention?: number;
  clarity?: number;
  brand_fit?: number;
  audience_fit?: number;
  critique?: string;
  suggested_mutation?: string;
};
/** Bir jürinin tek çağrıda turun tüm adayları için döndürdüğü çıktı */
export type JudgeVerdict = {
  scores: Record<string, JudgeCandidateVerdict>;
  ranking?: string[];
};

export const SCORE_WEIGHTS = { judge: 0.55, borda: 0.25, lint: 0.2 } as const;
/** Yakınsama: son iki turda en iyi totalScore artışı bu eşiğin altındaysa erken dur */
export const CONVERGENCE_MIN_GAIN = 2;
/** Jüri uyumu eşikleri (kazananın jüri puanlarının std sapması) */
export const CONFIDENCE_STD = { high: 5, medium: 12 } as const;

function clampScore(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.max(1, Math.min(10, n));
}

/** 1-10 boyut puanlarını ağırlıklı ortalamayla 0-100'e ölçekler; puan yoksa null */
export function weightedJudgeScore(
  verdict: JudgeCandidateVerdict | undefined,
  weights: JudgeWeights,
): number | null {
  if (!verdict) return null;
  let sum = 0;
  let wsum = 0;
  for (const dim of JUDGE_DIMENSIONS) {
    const v = clampScore(verdict[dim]);
    if (v === null) continue;
    sum += v * weights[dim];
    wsum += weights[dim];
  }
  if (wsum === 0) return null;
  return round2((sum / wsum) * 10);
}

/** Jürinin sıralaması geçerliyse (tam küme, tekrar yok) onu; değilse ağırlıklı puana göre türetilmiş sıralamayı döndürür. */
export function effectiveRanking(
  ids: string[],
  verdict: JudgeVerdict,
  weights: JudgeWeights,
): { ranking: string[]; source: "judge" | "derived" } {
  const r = verdict.ranking;
  if (
    Array.isArray(r) &&
    r.length === ids.length &&
    new Set(r).size === ids.length &&
    r.every((id) => ids.includes(id))
  ) {
    return { ranking: r, source: "judge" };
  }
  const derived = [...ids].sort((a, b) => {
    const sa = weightedJudgeScore(verdict.scores?.[a], weights) ?? -1;
    const sb = weightedJudgeScore(verdict.scores?.[b], weights) ?? -1;
    return sb - sa || a.localeCompare(b);
  });
  return { ranking: derived, source: "derived" };
}

/** Borda: n aday için 1. sıra n-1 puan … son sıra 0; 0-100'e normalize */
export function bordaPoints(ranking: string[]): Map<string, number> {
  const n = ranking.length;
  const out = new Map<string, number>();
  ranking.forEach((id, i) => {
    out.set(id, n <= 1 ? 100 : round2(((n - 1 - i) / (n - 1)) * 100));
  });
  return out;
}

export type CombineInput = {
  candidates: Array<{ id: string; lintScore: number; eliminated: boolean }>;
  judges: Array<{ key: string; weights: JudgeWeights; verdict: JudgeVerdict }>;
  survivors: number;
};

export type CandidateScore = {
  id: string;
  judgeScore: number | null;
  borda: number | null;
  totalScore: number | null;
  rank: number | null;
  survived: boolean;
  /** jüriler arası ağırlıklı puanların std sapması (uyum göstergesi) */
  judgeStd: number | null;
  /** kaç jüri bu adayı 1. sıraya koydu */
  firstPlaceVotes: number;
  perJudge: Record<
    string,
    { weighted: number | null; rank: number | null; rankingSource: "judge" | "derived" }
  >;
};

export function combineScores(input: CombineInput): Map<string, CandidateScore> {
  const judged = input.candidates.filter((c) => !c.eliminated);
  const judgedIds = judged.map((c) => c.id);
  const out = new Map<string, CandidateScore>();

  // Her jürinin sıralaması + Borda'sı
  const perJudgeRanking = input.judges.map((j) => {
    const { ranking, source } = effectiveRanking(judgedIds, j.verdict, j.weights);
    return { key: j.key, ranking, source, borda: bordaPoints(ranking), weights: j.weights, verdict: j.verdict };
  });

  for (const c of input.candidates) {
    if (c.eliminated) {
      out.set(c.id, {
        id: c.id,
        judgeScore: null,
        borda: null,
        totalScore: null,
        rank: null,
        survived: false,
        judgeStd: null,
        firstPlaceVotes: 0,
        perJudge: {},
      });
      continue;
    }
    const weighted: number[] = [];
    const bordas: number[] = [];
    let firstPlaceVotes = 0;
    const perJudge: CandidateScore["perJudge"] = {};
    for (const j of perJudgeRanking) {
      const w = weightedJudgeScore(j.verdict.scores?.[c.id], j.weights);
      const rankIdx = j.ranking.indexOf(c.id);
      const rank = rankIdx === -1 ? null : rankIdx + 1;
      if (rank === 1) firstPlaceVotes++;
      if (w !== null) weighted.push(w);
      bordas.push(j.borda.get(c.id) ?? 0);
      perJudge[j.key] = { weighted: w, rank, rankingSource: j.source };
    }
    const judgeScore = weighted.length ? round2(mean(weighted)) : null;
    const borda = bordas.length ? round2(mean(bordas)) : null;
    const totalScore =
      judgeScore === null || borda === null
        ? null
        : round2(
            SCORE_WEIGHTS.judge * judgeScore +
              SCORE_WEIGHTS.borda * borda +
              SCORE_WEIGHTS.lint * c.lintScore,
          );
    out.set(c.id, {
      id: c.id,
      judgeScore,
      borda,
      totalScore,
      rank: null,
      survived: false,
      judgeStd: weighted.length >= 2 ? round2(stddev(weighted)) : null,
      firstPlaceVotes,
      perJudge,
    });
  }

  // Sıralama: totalScore ↓, judgeScore ↓, lintScore ↓, id (deterministik)
  const lintById = new Map(input.candidates.map((c) => [c.id, c.lintScore]));
  const ranked = judged
    .map((c) => out.get(c.id)!)
    .filter((s) => s.totalScore !== null)
    .sort(
      (a, b) =>
        b.totalScore! - a.totalScore! ||
        (b.judgeScore ?? 0) - (a.judgeScore ?? 0) ||
        (lintById.get(b.id) ?? 0) - (lintById.get(a.id) ?? 0) ||
        a.id.localeCompare(b.id),
    );
  ranked.forEach((s, i) => {
    s.rank = i + 1;
    s.survived = i < input.survivors;
  });
  return out;
}

/** Jüri uyumundan confidence: std sapma + 1. sıra oy çoğunluğu (AGENT-A §5) */
export function judgeConfidence(
  score: Pick<CandidateScore, "judgeStd" | "firstPlaceVotes">,
  judgeCount: number,
): "low" | "medium" | "high" {
  if (score.judgeStd === null || judgeCount < 2) return "low";
  const majority = score.firstPlaceVotes >= Math.ceil(judgeCount / 2);
  if (score.judgeStd <= CONFIDENCE_STD.high && majority) return "high";
  if (score.judgeStd <= CONFIDENCE_STD.medium) return "medium";
  return "low";
}

export type RoundOutcome = { bestTotal: number; bestLineage: string };

/**
 * Erken durdurma (AGENT-A §5): son 2 turda en iyi totalScore artışı < eşik
 * VEYA aynı soy (ELITE zinciri) 2 tur üst üste 1.
 */
export function checkConvergence(history: RoundOutcome[]): {
  converged: boolean;
  reason: "low_gain" | "same_winner" | null;
} {
  if (history.length < 2) return { converged: false, reason: null };
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  if (last.bestLineage === prev.bestLineage) {
    return { converged: true, reason: "same_winner" };
  }
  if (last.bestTotal - prev.bestTotal < CONVERGENCE_MIN_GAIN) {
    return { converged: true, reason: "low_gain" };
  }
  return { converged: false, reason: null };
}

/**
 * Soy anahtarı: ELITE olarak taşınan aday, taşındığı adayla aynı soydur;
 * mutasyon/crossover çocukları yeni soydur.
 */
export function lineageKey(
  id: string,
  byId: Map<string, { origin: string; parentId: string | null }>,
): string {
  let cur = id;
  const guard = new Set<string>();
  for (;;) {
    const c = byId.get(cur);
    if (!c || c.origin !== "ELITE" || !c.parentId || guard.has(cur)) return cur;
    guard.add(cur);
    cur = c.parentId;
  }
}

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
export function stddev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
