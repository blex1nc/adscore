import "server-only";
import { prisma } from "@adscore/db";
import { AiBlockedError, getAiProvider } from "@adscore/ai";
import { audit } from "@/lib/audit";
import { computeMetrics } from "@/lib/results/metrics";
import { computeBrandScores, type ScoreableResult } from "./adscore";
import { detectSignals } from "./signals";
import {
  buildOptimizationPrompt,
  OPTIMIZATION_SYSTEM_PROMPT,
  type OptimizationResult,
} from "./prompts";

function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

// Marka geneli: sonuçlar + koddan hesaplanan metrikler/skorlar/sinyaller AI'a
// hazır verilir; AI sayı üretmez, yorumlar (CLAUDE.md §25/§28).
export async function buildOptimizationSnapshot(brandId: string) {
  const plans = await prisma.campaignPlan.findMany({
    where: { brandId, results: { some: {} } },
    include: {
      creatives: { select: { headline: true, strategy: true } },
      results: { orderBy: { periodStart: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  const scoreablePlans = plans.map((plan) => ({
    id: plan.id,
    results: plan.results.map(
      (r): ScoreableResult => ({
        id: r.id,
        planId: plan.id,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        impressions: r.impressions,
        clicks: r.clicks,
        metrics: computeMetrics({
          spend: Number(r.spend),
          impressions: r.impressions,
          clicks: r.clicks,
          reach: r.reach,
          purchases: r.purchases,
          revenue: r.revenue == null ? null : Number(r.revenue),
        }),
      }),
    ),
  }));

  const allResults = scoreablePlans.flatMap((p) => p.results);
  const scores = computeBrandScores(allResults);
  const signals = detectSignals(scoreablePlans);

  const snapshot = {
    plans: plans.map((plan) => ({
      plan_id: plan.id,
      goal: plan.goal,
      budget: `${plan.budgetAmount} ${plan.currency} (${plan.budgetType === "DAILY" ? "günlük" : "toplam"})`,
      creatives: plan.creatives,
      results: plan.results.map((r) => {
        const scoreable = scoreablePlans
          .find((p) => p.id === plan.id)!
          .results.find((s) => s.id === r.id)!;
        return {
          result_id: r.id,
          period: `${r.periodStart.toISOString().slice(0, 10)} - ${r.periodEnd.toISOString().slice(0, 10)}`,
          raw: {
            spend: Number(r.spend),
            impressions: r.impressions,
            clicks: r.clicks,
            reach: r.reach,
            purchases: r.purchases,
            revenue: r.revenue == null ? null : Number(r.revenue),
          },
          computed_metrics: scoreable.metrics,
          adscore: scores.get(r.id) ?? null,
        };
      }),
    })),
    observed_signals: signals,
  };

  return { snapshot, scores, signals, resultCount: allResults.length };
}

export async function executeOptimizationRun(runId: string): Promise<void> {
  const run = await prisma.optimizationRun.findUnique({
    where: { id: runId },
    include: { brand: true },
  });
  if (!run || run.status !== "QUEUED") return;

  await prisma.optimizationRun.update({
    where: { id: runId },
    data: { status: "RUNNING" },
  });

  try {
    const ai = getAiProvider();
    const [{ snapshot }, learnings] = await Promise.all([
      buildOptimizationSnapshot(run.brandId),
      prisma.learning.findMany({
        where: { brandId: run.brandId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    await prisma.optimizationRun.update({
      where: { id: runId },
      data: { input: snapshot as object },
    });

    const completion = await ai.generateJson({
      system: OPTIMIZATION_SYSTEM_PROMPT,
      prompt: buildOptimizationPrompt({
        brandName: run.brand.name,
        description: run.brand.description,
        targetMarket: run.brand.targetMarket,
        snapshot,
        learnings: learnings.map((l) => ({
          text: l.text,
          confidence: l.confidence,
          sampleNote: l.sampleNote,
        })),
      }),
    });

    let result: OptimizationResult;
    try {
      result = parseModelJson(completion.text) as OptimizationResult;
    } catch {
      throw new Error("Model çıktısı geçerli JSON değildi. Tekrar dene.");
    }

    const valid = (result.recommendations ?? []).filter(
      (r) => r.observation && r.evidence && r.action,
    );
    if (valid.length === 0) {
      throw new Error("Model kullanılabilir öneri üretmedi. Tekrar dene.");
    }

    await prisma.$transaction([
      prisma.optimizationRun.update({
        where: { id: runId },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          result: result as object,
          model: completion.model,
          promptTokens: completion.promptTokens,
          outputTokens: completion.outputTokens,
        },
      }),
      prisma.recommendation.createMany({
        data: valid.map((r) => ({
          runId,
          brandId: run.brandId,
          kind: r.kind === "test" ? "test" : "optimization",
          observation: r.observation!,
          causes: r.possible_causes?.length
            ? r.possible_causes.join(" · ")
            : null,
          evidence: r.evidence!,
          action: r.action!,
          confidence: r.confidence ?? "low",
        })),
      }),
    ]);
    await audit({
      workspaceId: run.brand.workspaceId,
      action: "optimization_run.completed",
      entity: "optimization_run",
      entityId: runId,
      newState: { recommendationCount: valid.length },
    });
  } catch (error) {
    const message =
      error instanceof AiBlockedError
        ? `BLOCKED: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Bilinmeyen hata.";
    await prisma.optimizationRun.update({
      where: { id: runId },
      data: { status: "FAILED", finishedAt: new Date(), error: message },
    });
  }
}
