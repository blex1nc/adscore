"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  MIN_CLICKS_FOR_ANALYSIS,
  MIN_IMPRESSIONS_FOR_ANALYSIS,
} from "@/lib/results/metrics";
import { executeOptimizationRun } from "@/lib/optimization/run";

export type OptimizationFormState = { error?: string };

export async function startOptimizationRun(
  brandId: string,
  _prev: OptimizationFormState,
  _formData: FormData,
): Promise<OptimizationFormState> {
  const user = await requireUser();
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspace: { ownerId: user.id } },
  });
  if (!brand) return { error: "Marka bulunamadı." };

  const active = await prisma.optimizationRun.findFirst({
    where: { brandId, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (active) return { error: "Bir optimizasyon koşusu zaten sürüyor." };

  // CLAUDE.md §28 — yeterli veriye sahip en az 1 sonuç olmadan koşulmaz
  const eligibleCount = await prisma.campaignResult.count({
    where: {
      plan: { brandId },
      impressions: { gte: MIN_IMPRESSIONS_FOR_ANALYSIS },
      clicks: { gte: MIN_CLICKS_FOR_ANALYSIS },
    },
  });
  if (eligibleCount === 0) {
    return {
      error: `Insufficient Data: optimizasyon için en az ${MIN_IMPRESSIONS_FOR_ANALYSIS} gösterim ve ${MIN_CLICKS_FOR_ANALYSIS} tıklamaya ulaşmış en az 1 kampanya sonucu gerekir. Önce kampanya kitinden sonuç gir.`,
    };
  }

  const run = await prisma.optimizationRun.create({
    data: { brandId, resultCount: eligibleCount },
  });
  await audit({
    workspaceId: brand.workspaceId,
    userId: user.id,
    action: "optimization_run.start",
    entity: "optimization_run",
    entityId: run.id,
    newState: { eligibleResultCount: eligibleCount },
  });
  after(() => executeOptimizationRun(run.id));
  revalidatePath(`/app/brands/${brandId}/optimization`);
  return {};
}

// CLAUDE.md §30 — human override: öneri yalnız kullanıcı kararıyla sonuçlanır.
// Kabul dahi hiçbir şeyi otomatik uygulamaz; kullanıcı Ads Manager'da kendisi yapar.
export async function decideRecommendation(
  recommendationId: string,
  decision: "ACCEPTED" | "DISMISSED",
  _prev: OptimizationFormState,
  _formData: FormData,
): Promise<OptimizationFormState> {
  const user = await requireUser();
  const rec = await prisma.recommendation.findFirst({
    where: {
      id: recommendationId,
      run: { brand: { workspace: { ownerId: user.id } } },
    },
    include: { run: { include: { brand: true } } },
  });
  if (!rec) return { error: "Öneri bulunamadı." };
  if (rec.status !== "PROPOSED") {
    return { error: "Bu öneri zaten karara bağlanmış." };
  }

  await prisma.recommendation.update({
    where: { id: rec.id },
    data: { status: decision, decidedAt: new Date() },
  });
  await audit({
    workspaceId: rec.run.brand.workspaceId,
    userId: user.id,
    action: `recommendation.${decision.toLowerCase()}`,
    entity: "recommendation",
    entityId: rec.id,
    previousState: { status: rec.status },
    newState: { status: decision },
  });
  revalidatePath(`/app/brands/${rec.brandId}/optimization`);
  return {};
}
