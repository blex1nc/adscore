"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { executeResearchRun } from "@/lib/research/run";

export type ResearchActionState = { error?: string };

export async function startResearch(
  brandId: string,
  _prev: ResearchActionState,
  _formData: FormData,
): Promise<ResearchActionState> {
  const user = await requireUser();
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspace: { ownerId: user.id } },
  });
  if (!brand) return { error: "Marka bulunamadı." };
  if (!brand.website) {
    return {
      error:
        "Araştırma için önce markaya bir website ekle (yukarıdaki formdan).",
    };
  }

  const active = await prisma.researchRun.findFirst({
    where: { brandId, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (active) return { error: "Bu marka için zaten süren bir araştırma var." };

  const run = await prisma.researchRun.create({
    data: { brandId },
  });
  await audit({
    workspaceId: brand.workspaceId,
    userId: user.id,
    action: "research.start",
    entity: "research_run",
    entityId: run.id,
  });

  // Yanıt döndükten sonra arka planda çalışır (Next after()).
  // Gerçek queue/worker altyapısı Phase 2 sonunda ayrıca ele alınacak.
  after(() => executeResearchRun(run.id));

  revalidatePath(`/app/brands/${brandId}`);
  return {};
}
