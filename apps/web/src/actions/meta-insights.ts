"use server";

// C1 — "Meta'dan sonuçları çek" aksiyonu. Kullanıcı tetikler; otomatik senkron YOK.
// Veri lib/meta-insights/sync.ts üzerinden AYNI resultSchema doğrulamasıyla yazılır.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { runInsightSync } from "@/lib/meta-insights/sync";

export type MetaSyncState = {
  error?: string;
  blocked?: string;
  warnings?: string[];
  synced?: boolean;
  updated?: boolean;
};

const periodSchema = z
  .object({
    since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Başlangıç tarihi seç."),
    until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitiş tarihi seç."),
  })
  .refine((d) => d.until >= d.since, {
    message: "Bitiş tarihi başlangıçtan önce olamaz.",
  });

export async function syncMetaResults(
  planId: string,
  _prev: MetaSyncState,
  formData: FormData,
): Promise<MetaSyncState> {
  const user = await requireUser();
  const plan = await prisma.campaignPlan.findFirst({
    where: { id: planId, brand: { workspace: { ownerId: user.id } } },
    include: { brand: true },
  });
  if (!plan) return { error: "Plan bulunamadı." };

  if (!plan.metaCampaignId) {
    return {
      error:
        "Bu plan Meta'da bu panelden yayınlanmamış (Meta kampanya ID yok). Yayın akışını tamamla veya sonuçları elle/CSV ile gir.",
    };
  }

  const parsed = periodSchema.safeParse({
    since: formData.get("since"),
    until: formData.get("until"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dönem hatalı." };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (parsed.data.since > today) {
    return { error: "Başlangıç tarihi gelecekte olamaz." };
  }

  const outcome = await runInsightSync({
    planId,
    brandId: plan.brandId,
    metaCampaignId: plan.metaCampaignId,
    since: parsed.data.since,
    until: parsed.data.until > today ? today : parsed.data.until,
  });

  if (outcome.kind === "blocked") return { blocked: outcome.message };
  if (outcome.kind === "error") return { error: outcome.message };

  await audit({
    workspaceId: plan.brand.workspaceId,
    userId: user.id,
    action: "meta_insights.sync",
    entity: "campaign_result",
    entityId: outcome.resultId,
    newState: {
      planId,
      metaCampaignId: plan.metaCampaignId,
      since: parsed.data.since,
      until: parsed.data.until,
      updated: outcome.updated,
    },
  });
  revalidatePath(`/app/brands/${plan.brandId}/campaigns`);
  return { synced: true, updated: outcome.updated, warnings: outcome.warnings };
}
