import "server-only";
import { prisma } from "@adscore/db";
import { AiBlockedError, getAiProvider } from "@adscore/ai";
import { audit } from "@/lib/audit";
import { computeMetrics } from "./metrics";

// CLAUDE.md §25 — analiz: problem + olası nedenler + kanıt + öneri + confidence.
// CLAUDE.md §26 — öğrenmeler sample size notuyla saklanır; kesin gerçek değildir.
const RESULT_ANALYSIS_SYSTEM_PROMPT = `Sen bir Meta Ads performans analistisin. Kullanıcının ELLE girdiği kampanya sonuçlarını (Meta bağlantısı yok) yorumluyorsun.

Kesin kurallar:
1. YALNIZCA verilen sayıları kullan. Sektör benchmark'ı uydurma; kıyas gerekiyorsa "bu veriyle kesin kıyas yapılamaz" de.
2. Her teşhis için: gözlem + olası nedenler + kanıt (verilen sayıya referans) + önerilen aksiyon + confidence ("low"|"medium"|"high").
3. Örneklem küçükse (özellikle satın alma sayısı) bunu her ilgili çıkarımda açıkça belirt; güçlü sonuç çıkarma.
4. Öneriler tavsiyedir; kullanıcı uygular. Otomatik hiçbir şey değişmez.
5. Çıktı dili Türkçe; çıktı SADECE geçerli JSON.`;

function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

export type ResultAnalysis = {
  diagnosis?: Array<{
    observation?: string;
    possible_causes?: string[];
    evidence?: string;
    recommended_action?: string;
    confidence?: string;
  }>;
  learnings?: Array<{
    learning?: string;
    evidence?: string;
    confidence?: string;
    sample_note?: string;
  }>;
  data_gaps?: string[];
};

export async function executeResultAnalysis(resultId: string): Promise<void> {
  const result = await prisma.campaignResult.findUnique({
    where: { id: resultId },
    include: {
      plan: { include: { brand: true, creatives: true } },
    },
  });
  if (!result || result.analysisStatus !== "QUEUED") return;

  await prisma.campaignResult.update({
    where: { id: resultId },
    data: { analysisStatus: "RUNNING" },
  });

  try {
    const ai = getAiProvider();
    const metrics = computeMetrics({
      spend: Number(result.spend),
      impressions: result.impressions,
      clicks: result.clicks,
      reach: result.reach,
      purchases: result.purchases,
      revenue: result.revenue == null ? null : Number(result.revenue),
    });

    const prompt = `MARKA: ${result.plan.brand.name}
KAMPANYA PLANI: hedef=${result.plan.goal}, bütçe=${result.plan.budgetAmount} ${result.plan.currency} (${result.plan.budgetType === "DAILY" ? "günlük" : "toplam"}), creative sayısı=${result.plan.creatives.length}
DÖNEM: ${result.periodStart.toISOString().slice(0, 10)} - ${result.periodEnd.toISOString().slice(0, 10)}
KULLANICININ GİRDİĞİ HAM VERİ:
- Harcama: ${result.spend} ${result.plan.currency}
- Gösterim: ${result.impressions}
- Tıklama: ${result.clicks}
- Erişim: ${result.reach ?? "girilmedi"}
- Satın alma: ${result.purchases ?? "girilmedi"}
- Ciro: ${result.revenue ?? "girilmedi"}
- Not: ${result.notes ?? "yok"}

KODDAN HESAPLANAN METRİKLER (bunları aynen kullan, yeniden hesaplama):
${JSON.stringify(metrics)}

Şu JSON şemasına birebir uy:
{
  "diagnosis": [
    { "observation": string, "possible_causes": [string], "evidence": string, "recommended_action": string, "confidence": "low"|"medium"|"high" }
  ],
  "learnings": [
    { "learning": string, "evidence": string, "confidence": "low"|"medium"|"high", "sample_note": string }
  ],
  "data_gaps": [string]
}`;

    const completion = await ai.generateJson({
      system: RESULT_ANALYSIS_SYSTEM_PROMPT,
      prompt,
    });

    let analysis: ResultAnalysis;
    try {
      analysis = parseModelJson(completion.text) as ResultAnalysis;
    } catch {
      throw new Error("Model çıktısı geçerli JSON değildi. Tekrar dene.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.campaignResult.update({
        where: { id: resultId },
        data: {
          analysisStatus: "COMPLETED",
          analysis: analysis as object,
          model: completion.model,
          promptTokens: completion.promptTokens,
          outputTokens: completion.outputTokens,
        },
      });
      const learnings = (analysis.learnings ?? []).filter(
        (l) => l.learning && l.evidence,
      );
      if (learnings.length > 0) {
        await tx.learning.createMany({
          data: learnings.map((l) => ({
            brandId: result.plan.brandId,
            text: l.learning!,
            evidence: l.evidence!,
            confidence: l.confidence ?? "low",
            sampleNote: l.sample_note ?? "Örneklem notu verilmedi.",
            sourceResultId: resultId,
          })),
        });
      }
    });
    await audit({
      workspaceId: result.plan.brand.workspaceId,
      action: "result_analysis.completed",
      entity: "campaign_result",
      entityId: resultId,
    });
  } catch (error) {
    const message =
      error instanceof AiBlockedError
        ? `BLOCKED: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Bilinmeyen hata.";
    await prisma.campaignResult.update({
      where: { id: resultId },
      data: { analysisStatus: "FAILED", analysisError: message },
    });
  }
}
