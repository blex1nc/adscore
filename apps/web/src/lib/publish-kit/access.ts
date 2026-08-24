import "server-only";
import { prisma } from "@adscore/db";
import type { BuildKitInput, Kit, KitInputs } from "./types";

// Kit → plan → marka → workspace.ownerId zinciriyle sahiplik doğrulaması.
// Sahip değilse null (route'lar 404 döner; varlık sızdırılmaz).
export async function findOwnedKit(kitId: string, userId: string) {
  const kit = await prisma.publishKit.findFirst({
    where: { id: kitId, plan: { brand: { workspace: { ownerId: userId } } } },
    include: {
      plan: {
        select: {
          id: true,
          brandId: true,
          publishedAt: true,
          publishNote: true,
          brand: { select: { id: true, name: true, workspaceId: true } },
        },
      },
    },
  });
  return kit;
}

export function readKit(json: unknown): Kit | null {
  if (!json || typeof json !== "object") return null;
  const k = json as Partial<Kit>;
  if (k.version !== 1 || !Array.isArray(k.sections)) return null;
  return k as Kit;
}

export function readChecklist(json: unknown): Record<string, boolean> {
  if (!json || typeof json !== "object") return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (v === true) out[k] = true;
  }
  return out;
}

// Plan + onaylı creative'ler + marka: builder girdisi (yalnız APPROVED + COMPLETED görseller)
export async function loadBuilderSource(planId: string, userId: string) {
  return prisma.campaignPlan.findFirst({
    where: { id: planId, brand: { workspace: { ownerId: userId } } },
    include: {
      brand: {
        select: {
          id: true,
          name: true,
          website: true,
          currency: true,
          targetMarket: true,
          copyLanguage: true,
          workspaceId: true,
        },
      },
      creatives: {
        where: { approval: "APPROVED" },
        orderBy: { createdAt: "asc" },
        include: {
          images: {
            where: { status: "COMPLETED", NOT: { data: null } },
            orderBy: { createdAt: "asc" },
            select: { id: true, status: true },
          },
        },
      },
      kits: { orderBy: { version: "desc" }, take: 1, select: { version: true, kit: true } },
    },
  });
}

type BuilderSource = NonNullable<Awaited<ReturnType<typeof loadBuilderSource>>>;

// Prisma kaydını builder'ın yapısal girdisine çevirir (Decimal → string, görsel → hasData)
export function toBuilderInput(source: BuilderSource, inputs: KitInputs): BuildKitInput {
  return {
    plan: {
      id: source.id,
      status: source.status,
      goal: source.goal,
      budgetType: source.budgetType,
      budgetAmount: source.budgetAmount.toString(),
      currency: source.currency,
      durationDays: source.durationDays,
      result: source.result,
    },
    creatives: source.creatives.map((c) => ({
      id: c.id,
      approval: c.approval,
      headline: c.headline,
      primaryText: c.primaryText,
      description: c.description,
      cta: c.cta,
      why: c.why,
      confidence: c.confidence,
      // loadBuilderSource yalnız COMPLETED + data dolu görselleri getirir
      images: c.images.map((i) => ({ id: i.id, status: i.status, hasData: true })),
    })),
    brand: source.brand,
    inputs,
  };
}
