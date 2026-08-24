import "server-only";
// Yayın hattı erişim/yükleme yardımcıları (Prisma). Sahiplik zinciri:
// plan → marka → workspace.ownerId (publish-kit/access ile aynı desen).

import { prisma } from "@adscore/db";
import { matchObjective } from "@/lib/publish-kit/build";
import type { PublishPlanInput } from "./types";

/** Plan + marka + onaylı creative'ler (görselli) + Meta izleri. Sahip değilse null. */
export async function loadPublishSource(planId: string, userId: string) {
  return prisma.campaignPlan.findFirst({
    where: { id: planId, brand: { workspace: { ownerId: userId } } },
    include: {
      brand: {
        select: {
          id: true,
          name: true,
          website: true,
          workspaceId: true,
          workspace: { select: { maxDailyBudget: true } },
        },
      },
      creatives: {
        where: { approval: "APPROVED" },
        orderBy: { createdAt: "asc" },
        include: {
          images: {
            where: { status: "COMPLETED", NOT: { data: null } },
            orderBy: { createdAt: "asc" },
            select: { id: true, mimeType: true },
          },
        },
      },
      publishes: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export type PublishSource = NonNullable<Awaited<ReturnType<typeof loadPublishSource>>>;

/** Plan sonucundan objective anahtarı (publish-kit eşleyicisiyle aynı mantık). */
export function planObjectiveKey(source: PublishSource): string | null {
  const result = (source.result ?? {}) as {
    objective?: { key?: string; recommended?: string };
  };
  const matched = matchObjective(result.objective?.key, result.objective?.recommended);
  return matched?.key ?? null;
}

/** Prisma kaydı → saf üreticilerin plan girdisi. objectiveKey çıkarılamazsa null. */
export function toPublishPlanInput(source: PublishSource): PublishPlanInput | null {
  const objectiveKey = planObjectiveKey(source);
  if (!objectiveKey) return null;
  return {
    id: source.id,
    goal: source.goal,
    budgetType: source.budgetType,
    budgetAmount: source.budgetAmount.toString(),
    currency: source.currency,
    durationDays: source.durationDays,
    objectiveKey,
    specialAdCategories: source.specialAdCategories,
  };
}

/** Yayının ön koşulları — eksikler TR metin listesi olarak döner (dürüst kapı). */
export function publishBlockers(source: PublishSource): string[] {
  const blockers: string[] = [];
  if (source.status !== "COMPLETED") {
    blockers.push("Kampanya planı tamamlanmamış (COMPLETED değil).");
  }
  if (source.creatives.length === 0) {
    blockers.push("Onaylı (APPROVED) creative yok. Önce bir creative onaylayın.");
  } else if (!source.creatives.some((c) => c.images.length > 0)) {
    blockers.push("Onaylı creative'lerin tamamlanmış görseli yok. Önce görsel üretin.");
  }
  if (!planObjectiveKey(source)) {
    blockers.push("Plan sonucundan reklam amacı (objective) çıkarılamadı.");
  }
  if (source.specialAdCategories.length === 0) {
    blockers.push("Özel reklam kategorisi sorusu cevaplanmamış (varsayılan seçilmez).");
  }
  if (!source.metaTargeting) {
    blockers.push("Meta hedeflemesi seçilmemiş (serbest metin öneri yayına gidemez).");
  }
  return blockers;
}

/** Seçilen görselin sahiplik + durum doğrulaması; bytes döner. */
export async function loadImageBytes(
  imageId: string,
  creativeId: string,
  userId: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
  const img = await prisma.creativeImage.findFirst({
    where: {
      id: imageId,
      creativeId,
      status: "COMPLETED",
      creative: {
        approval: "APPROVED",
        brand: { workspace: { ownerId: userId } },
      },
    },
    select: { data: true, mimeType: true },
  });
  if (!img?.data) return null;
  return { data: Buffer.from(img.data), mimeType: img.mimeType ?? "image/png" };
}
