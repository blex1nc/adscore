import "server-only";
import { prisma } from "@adscore/db";
import { AiBlockedError, getAiProvider } from "@adscore/ai";
import { audit } from "@/lib/audit";
import {
  buildCreativePrompt,
  CREATIVE_SYSTEM_PROMPT,
  type CreativeVariant,
} from "./prompts";

export const VARIANT_COUNT = 3;

function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

export async function executeCreativeGeneration(
  generationId: string,
): Promise<void> {
  const generation = await prisma.creativeGeneration.findUnique({
    where: { id: generationId },
    include: { brand: true },
  });
  if (!generation || generation.status !== "QUEUED") return;

  await prisma.creativeGeneration.update({
    where: { id: generationId },
    data: { status: "RUNNING" },
  });

  try {
    const ai = getAiProvider();
    const [research, pattern, learnings] = await Promise.all([
      prisma.researchRun.findFirst({
        where: { brandId: generation.brandId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.patternAnalysis.findFirst({
        where: { brandId: generation.brandId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
      }),
      // CLAUDE.md §26 — öğrenme döngüsü: geçmiş bulgular yeni üretime hipotez olarak girer
      prisma.learning.findMany({
        where: { brandId: generation.brandId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const completion = await ai.generateJson({
      system: CREATIVE_SYSTEM_PROMPT,
      prompt: buildCreativePrompt({
        brandName: generation.brand.name,
        description: generation.brand.description,
        targetMarket: generation.brand.targetMarket,
        copyLanguage: generation.brand.copyLanguage,
        researchResult: research?.result ?? null,
        patternResult: pattern?.result ?? null,
        instruction: generation.instruction,
        offer: generation.offer,
        learnings: learnings.map((l) => ({
          text: l.text,
          confidence: l.confidence,
          sampleNote: l.sampleNote,
        })),
        variantCount: VARIANT_COUNT,
      }),
    });

    let variants: CreativeVariant[];
    try {
      const parsed = parseModelJson(completion.text) as {
        variants?: CreativeVariant[];
      };
      variants = parsed.variants ?? [];
    } catch {
      throw new Error("Model çıktısı geçerli JSON değildi. Tekrar dene.");
    }
    const valid = variants.filter(
      (v) => v.primary_text && v.headline && v.cta && v.strategy && v.hook,
    );
    if (valid.length === 0) {
      throw new Error("Model kullanılabilir varyant üretmedi. Tekrar dene.");
    }

    await prisma.$transaction([
      prisma.creative.createMany({
        data: valid.map((v) => ({
          brandId: generation.brandId,
          generationId,
          strategy: v.strategy!,
          hook: v.hook!,
          primaryText: v.primary_text!,
          headline: v.headline!,
          description: v.description || null,
          cta: v.cta!,
          targetNote: v.target_note || null,
          why: v.why || "",
          confidence: v.confidence || "low",
        })),
      }),
      prisma.creativeGeneration.update({
        where: { id: generationId },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          model: completion.model,
          promptTokens: completion.promptTokens,
          outputTokens: completion.outputTokens,
        },
      }),
    ]);
    await audit({
      workspaceId: generation.brand.workspaceId,
      action: "creative_generation.completed",
      entity: "creative_generation",
      entityId: generationId,
      newState: { variantCount: valid.length },
    });
  } catch (error) {
    const message =
      error instanceof AiBlockedError
        ? `BLOCKED: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Bilinmeyen hata.";
    await prisma.creativeGeneration.update({
      where: { id: generationId },
      data: { status: "FAILED", finishedAt: new Date(), error: message },
    });
  }
}
