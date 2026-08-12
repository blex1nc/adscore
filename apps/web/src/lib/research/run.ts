import "server-only";
import { prisma } from "@adscore/db";
import { AiBlockedError, getAiProvider } from "@adscore/ai";
import { audit } from "@/lib/audit";
import { fetchWebsiteText } from "./fetch-site";
import { buildResearchPrompt, RESEARCH_SYSTEM_PROMPT } from "./prompt";

function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

/**
 * Bir araştırma koşusunu uçtan uca yürütür.
 * Hata durumlarında sahte veri üretmez; run FAILED olarak işaretlenir
 * ve hata nedeni kullanıcıya aynen gösterilir (CLAUDE.md §33, §42).
 */
export async function executeResearchRun(runId: string): Promise<void> {
  const run = await prisma.researchRun.findUnique({
    where: { id: runId },
    include: { brand: true },
  });
  if (!run || run.status !== "QUEUED") return;

  await prisma.researchRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    if (!run.brand.website) {
      throw new Error(
        "Markanın website adresi yok. Araştırma v1 website gerektirir; marka ayarlarından ekleyebilirsin.",
      );
    }

    // AI sağlayıcı hazır mı? (Key yoksa site fetch'e hiç girmeden BLOCKED)
    const ai = getAiProvider();

    const site = await fetchWebsiteText(run.brand.website);
    await prisma.researchSource.create({
      data: {
        runId,
        url: site.url,
        type: "official_website",
        reliability: "primary",
        usedFor: "brand_profile",
        httpStatus: site.httpStatus,
      },
    });

    const completion = await ai.generateJson({
      system: RESEARCH_SYSTEM_PROMPT,
      prompt: buildResearchPrompt({
        brandName: run.brand.name,
        description: run.brand.description,
        targetMarket: run.brand.targetMarket,
        site,
      }),
    });

    let result: unknown;
    try {
      result = parseModelJson(completion.text);
    } catch {
      throw new Error(
        "Model çıktısı geçerli JSON değildi. Tekrar deneyebilirsin.",
      );
    }

    await prisma.researchRun.update({
      where: { id: runId },
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
      workspaceId: run.brand.workspaceId,
      action: "research.completed",
      entity: "research_run",
      entityId: runId,
    });
  } catch (error) {
    const message =
      error instanceof AiBlockedError
        ? `BLOCKED: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Bilinmeyen hata.";
    await prisma.researchRun.update({
      where: { id: runId },
      data: { status: "FAILED", finishedAt: new Date(), error: message },
    });
    await audit({
      workspaceId: run.brand.workspaceId,
      action: "research.failed",
      entity: "research_run",
      entityId: runId,
      newState: { error: message },
    });
  }
}
