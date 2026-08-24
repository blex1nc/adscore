import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bordaPoints,
  checkConvergence,
  combineScores,
  effectiveRanking,
  judgeConfidence,
  lineageKey,
  weightedJudgeScore,
  JUDGE_PERSONAS,
} from "../select";

const W = JUDGE_PERSONAS[0].weights; // attention ×2

test("weightedJudgeScore: ağırlıklı ortalama 0-100", () => {
  // attention 10 ×2, diğerleri 5 → (20+5+5+5)/5 = 7 → 70
  assert.equal(
    weightedJudgeScore({ attention: 10, clarity: 5, brand_fit: 5, audience_fit: 5 }, W),
    70,
  );
  assert.equal(weightedJudgeScore(undefined, W), null);
  // 1-10 dışı değerler kırpılır
  assert.equal(
    weightedJudgeScore({ attention: 50, clarity: -3, brand_fit: 10, audience_fit: 10 }, W),
    (10 * 2 + 1 + 10 + 10) / 5 * 10,
  );
});

test("bordaPoints: n-1..0 → 0-100", () => {
  const b = bordaPoints(["a", "b", "c"]);
  assert.equal(b.get("a"), 100);
  assert.equal(b.get("b"), 50);
  assert.equal(b.get("c"), 0);
  assert.equal(bordaPoints(["x"]).get("x"), 100);
});

test("effectiveRanking: geçersiz/eksik jüri sıralaması puandan türetilir", () => {
  const verdict = {
    scores: {
      a: { attention: 3, clarity: 3, brand_fit: 3, audience_fit: 3 },
      b: { attention: 9, clarity: 9, brand_fit: 9, audience_fit: 9 },
    },
    ranking: ["a", "zzz"],
  };
  const r = effectiveRanking(["a", "b"], verdict, W);
  assert.equal(r.source, "derived");
  assert.deepEqual(r.ranking, ["b", "a"]);
  const ok = effectiveRanking(["a", "b"], { ...verdict, ranking: ["a", "b"] }, W);
  assert.equal(ok.source, "judge");
});

test("combineScores: formül 0.55·jüri + 0.25·borda + 0.20·lint, sıralama ve elit", () => {
  const judges = [
    {
      key: "j1",
      weights: { attention: 1, clarity: 1, brand_fit: 1, audience_fit: 1 },
      verdict: {
        scores: {
          a: { attention: 8, clarity: 8, brand_fit: 8, audience_fit: 8 },
          b: { attention: 4, clarity: 4, brand_fit: 4, audience_fit: 4 },
        },
        ranking: ["a", "b"],
      },
    },
    {
      key: "j2",
      weights: { attention: 1, clarity: 1, brand_fit: 1, audience_fit: 1 },
      verdict: {
        scores: {
          a: { attention: 6, clarity: 6, brand_fit: 6, audience_fit: 6 },
          b: { attention: 6, clarity: 6, brand_fit: 6, audience_fit: 6 },
        },
        ranking: ["b", "a"],
      },
    },
  ];
  const out = combineScores({
    candidates: [
      { id: "a", lintScore: 100, eliminated: false },
      { id: "b", lintScore: 80, eliminated: false },
      { id: "x", lintScore: 0, eliminated: true },
    ],
    judges,
    survivors: 1,
  });
  const a = out.get("a")!;
  const b = out.get("b")!;
  assert.equal(a.judgeScore, 70); // (80+60)/2
  assert.equal(b.judgeScore, 50); // (40+60)/2
  assert.equal(a.borda, 50); // (100+0)/2
  assert.equal(b.borda, 50);
  assert.equal(a.totalScore, 0.55 * 70 + 0.25 * 50 + 0.2 * 100);
  assert.equal(b.totalScore, 0.55 * 50 + 0.25 * 50 + 0.2 * 80);
  assert.equal(a.rank, 1);
  assert.equal(b.rank, 2);
  assert.equal(a.survived, true);
  assert.equal(b.survived, false);
  assert.equal(a.firstPlaceVotes, 1);
  assert.equal(a.judgeStd, 10);
  const x = out.get("x")!;
  assert.equal(x.totalScore, null);
  assert.equal(x.rank, null);
  assert.equal(x.survived, false);
});

test("judgeConfidence: düşük sapma + çoğunluk → high; yüksek sapma → low", () => {
  assert.equal(judgeConfidence({ judgeStd: 3, firstPlaceVotes: 2 }, 3), "high");
  assert.equal(judgeConfidence({ judgeStd: 3, firstPlaceVotes: 1 }, 3), "medium");
  assert.equal(judgeConfidence({ judgeStd: 10, firstPlaceVotes: 3 }, 3), "medium");
  assert.equal(judgeConfidence({ judgeStd: 20, firstPlaceVotes: 3 }, 3), "low");
  assert.equal(judgeConfidence({ judgeStd: null, firstPlaceVotes: 1 }, 1), "low");
});

test("checkConvergence: aynı soy 2 tur üst üste 1. → same_winner; artış < 2 → low_gain", () => {
  assert.deepEqual(checkConvergence([{ bestTotal: 60, bestLineage: "a" }]), {
    converged: false,
    reason: null,
  });
  assert.deepEqual(
    checkConvergence([
      { bestTotal: 60, bestLineage: "a" },
      { bestTotal: 70, bestLineage: "a" },
    ]),
    { converged: true, reason: "same_winner" },
  );
  assert.deepEqual(
    checkConvergence([
      { bestTotal: 60, bestLineage: "a" },
      { bestTotal: 61.5, bestLineage: "b" },
    ]),
    { converged: true, reason: "low_gain" },
  );
  assert.deepEqual(
    checkConvergence([
      { bestTotal: 60, bestLineage: "a" },
      { bestTotal: 65, bestLineage: "b" },
    ]),
    { converged: false, reason: null },
  );
});

test("lineageKey: ELITE zinciri köke gider, mutasyon yeni soydur", () => {
  const byId = new Map([
    ["r0", { origin: "SEED", parentId: null }],
    ["r1e", { origin: "ELITE", parentId: "r0" }],
    ["r2e", { origin: "ELITE", parentId: "r1e" }],
    ["r1m", { origin: "MUTATION", parentId: "r0" }],
  ]);
  assert.equal(lineageKey("r2e", byId), "r0");
  assert.equal(lineageKey("r1m", byId), "r1m");
});
