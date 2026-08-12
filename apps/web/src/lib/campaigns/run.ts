import "server-only";
import { prisma } from "@adscore/db";
import { AiBlockedError, getAiProvider } from "@adscore/ai";
import { audit } from "@/lib/audit";
import {
  buildCampaignPlanPrompt,
  CAMPAIGN_PLAN_SYSTEM_PROMPT,
} from "./prompts";

function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

export async function executeCampaignPlan(planId: string): Promise<void> {
  const plan = await prisma.campaignPlan.findUnique({
    where: { id: planId },
    include: { brand: true, creatives: true },
  });
  if (!plan || plan.status !== "QUEUED") return;

  await prisma.campaignPlan.update({
    where: { id: planId },
    data: { status: "RUNNING" },
  });

  try {
    const ai = getAiProvider();
    const [research, pattern] = await Promise.all([
      prisma.researchRun.findFirst({
        where: { brandId: plan.brandId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.patternAnalysis.findFirst({
        where: { brandId: plan.brandId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const completion = await ai.generateJson({
      system: CAMPAIGN_PLAN_SYSTEM_PROMPT,
      prompt: buildCampaignPlanPrompt({
        brandName: plan.brand.name,
        description: plan.brand.description,
        targetMarket: plan.brand.targetMarket,
        goal: plan.goal,
        budgetType: plan.budgetType,
        budgetAmount: plan.budgetAmount.toString(),
        currency: plan.currency,
        durationDays: plan.durationDays,
        notes: plan.notes,
        researchResult: research?.result ?? null,
        patternResult: pattern?.result ?? null,
        creatives: plan.creatives.map((c) => ({
          headline: c.headline,
          primaryText: c.primaryText,
          cta: c.cta,
          strategy: c.strategy,
        })),
      }),
    });

    let result: unknown;
    try {
      result = parseModelJson(completion.text);
    } catch {
      throw new Error("Model çıktısı geçerli JSON değildi. Tekrar dene.");
    }

    await prisma.campaignPlan.update({
      where: { id: planId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        result: result as object,
        model: completion.model,
        promptTokens: completion.promptTokens,
        outputTokens: completion.outputTokens,
      },
    });
    await audit({
      workspaceId: plan.brand.workspaceId,
      action: "campaign_plan.completed",
      entity: "campaign_plan",
      entityId: planId,
    });
  } catch (error) {
    const message =
      error instanceof AiBlockedError
        ? `BLOCKED: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Bilinmeyen hata.";
    await prisma.campaignPlan.update({
      where: { id: planId },
      data: { status: "FAILED", finishedAt: new Date(), error: message },
    });
  }
}
