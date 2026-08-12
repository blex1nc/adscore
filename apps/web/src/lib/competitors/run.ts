import "server-only";
import { prisma } from "@adscore/db";
import { AiBlockedError, getAiProvider } from "@adscore/ai";
import { audit } from "@/lib/audit";
import {
  AD_ANALYSIS_SYSTEM_PROMPT,
  buildAdAnalysisPrompt,
  buildPatternPrompt,
  PATTERN_SYSTEM_PROMPT,
} from "./prompts";

function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

function errorMessage(error: unknown): string {
  if (error instanceof AiBlockedError) return `BLOCKED: ${error.message}`;
  if (error instanceof Error) return error.message;
  return "Bilinmeyen hata.";
}

export async function executeAdAnalysis(adId: string): Promise<void> {
  const ad = await prisma.competitorAd.findUnique({
    where: { id: adId },
    include: { competitor: { include: { brand: true } } },
  });
  if (!ad || ad.status !== "QUEUED") return;

  await prisma.competitorAd.update({
    where: { id: adId },
    data: { status: "RUNNING" },
  });

  try {
    const ai = getAiProvider();
    const completion = await ai.generateJson({
      system: AD_ANALYSIS_SYSTEM_PROMPT,
      prompt: buildAdAnalysisPrompt({
        competitorName: ad.competitor.name,
        competitorType: ad.competitor.type,
        adText: ad.inputText,
        adUrl: ad.inputUrl,
      }),
    });
    let analysis: unknown;
    try {
      analysis = parseModelJson(completion.text);
    } catch {
      throw new Error("Model çıktısı geçerli JSON değildi. Tekrar dene.");
    }
    await prisma.competitorAd.update({
      where: { id: adId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        analysis: analysis as object,
        model: completion.model,
        promptTokens: completion.promptTokens,
        outputTokens: completion.outputTokens,
      },
    });
    await audit({
      workspaceId: ad.competitor.brand.workspaceId,
      action: "competitor_ad.analyzed",
      entity: "competitor_ad",
      entityId: adId,
    });
  } catch (error) {
    await prisma.competitorAd.update({
      where: { id: adId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: errorMessage(error),
      },
    });
  }
}

export const MIN_ADS_FOR_PATTERNS = 3;

export async function executePatternAnalysis(
  patternId: string,
): Promise<void> {
  const pattern = await prisma.patternAnalysis.findUnique({
    where: { id: patternId },
    include: { brand: true },
  });
  if (!pattern || pattern.status !== "QUEUED") return;

  await prisma.patternAnalysis.update({
    where: { id: patternId },
    data: { status: "RUNNING" },
  });

  try {
    const ads = await prisma.competitorAd.findMany({
      where: {
        competitor: { brandId: pattern.brandId },
        status: "COMPLETED",
      },
      include: { competitor: true },
      orderBy: { createdAt: "asc" },
    });
    if (ads.length < MIN_ADS_FOR_PATTERNS) {
      throw new Error(
        `Pattern analizi için en az ${MIN_ADS_FOR_PATTERNS} analiz edilmiş reklam gerekir (şu an ${ads.length}). Tek reklamdan strateji çıkarılmaz.`,
      );
    }

    const ai = getAiProvider();
    const completion = await ai.generateJson({
      system: PATTERN_SYSTEM_PROMPT,
      prompt: buildPatternPrompt({
        brandName: pattern.brand.name,
        targetMarket: pattern.brand.targetMarket,
        analyses: ads.map((ad) => ({
          competitor: ad.competitor.name,
          type: ad.competitor.type,
          analysis: ad.analysis,
        })),
      }),
      maxOutputTokens: 8192,
    });
    let result: unknown;
    try {
      result = parseModelJson(completion.text);
    } catch {
      throw new Error("Model çıktısı geçerli JSON değildi. Tekrar dene.");
    }
    await prisma.patternAnalysis.update({
      where: { id: patternId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        adCount: ads.length,
        result: result as object,
        model: completion.model,
        promptTokens: completion.promptTokens,
        outputTokens: completion.outputTokens,
      },
    });
    await audit({
      workspaceId: pattern.brand.workspaceId,
      action: "pattern_analysis.completed",
      entity: "pattern_analysis",
      entityId: patternId,
    });
  } catch (error) {
    await prisma.patternAnalysis.update({
      where: { id: patternId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: errorMessage(error),
      },
    });
  }
}
