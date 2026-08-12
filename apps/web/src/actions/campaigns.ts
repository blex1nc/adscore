"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma, type BudgetType } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { executeCampaignPlan } from "@/lib/campaigns/run";
import { CURRENCY_CODES } from "@/lib/options";

export type CampaignFormState = { error?: string };

const planSchema = z.object({
  goal: z.enum(["SALES", "TRAFFIC", "LEADS", "AWARENESS"]),
  budgetType: z.enum(["DAILY", "LIFETIME"]),
  budgetAmount: z.coerce
    .number()
    .positive("Bütçe sıfırdan büyük olmalı.")
    .max(100_000_000),
  currency: z.enum(CURRENCY_CODES as [string, ...string[]]),
  durationDays: z.coerce.number().int().positive().max(365).optional(),
  notes: z.string().max(500).optional(),
});

export async function startCampaignPlan(
  brandId: string,
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const user = await requireUser();
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspace: { ownerId: user.id } },
  });
  if (!brand) return { error: "Marka bulunamadı." };

  // CLAUDE.md §16 — kampanyaya yalnızca ONAYLI creative girer
  const creativeIds = formData
    .getAll("creativeIds")
    .map(String)
    .filter(Boolean);
  if (creativeIds.length === 0) {
    return { error: "En az bir onaylı creative seçmelisin." };
  }
  const approved = await prisma.creative.findMany({
    where: { id: { in: creativeIds }, brandId, approval: "APPROVED" },
    select: { id: true },
  });
  if (approved.length !== creativeIds.length) {
    return { error: "Seçimde onaylı olmayan creative var; sayfayı yenile." };
  }

  const raw = Object.fromEntries(formData);
  const parsed = planSchema.safeParse({
    ...raw,
    durationDays: raw.durationDays || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }

  const active = await prisma.campaignPlan.findFirst({
    where: { brandId, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (active) return { error: "Zaten hazırlanan bir plan var." };

  const plan = await prisma.campaignPlan.create({
    data: {
      brandId,
      goal: parsed.data.goal,
      budgetType: parsed.data.budgetType as BudgetType,
      budgetAmount: parsed.data.budgetAmount,
      currency: parsed.data.currency,
      durationDays: parsed.data.durationDays ?? null,
      notes: parsed.data.notes || null,
      creatives: { connect: approved.map((c) => ({ id: c.id })) },
    },
  });
  await audit({
    workspaceId: brand.workspaceId,
    userId: user.id,
    action: "campaign_plan.start",
    entity: "campaign_plan",
    entityId: plan.id,
    newState: {
      goal: parsed.data.goal,
      budget: `${parsed.data.budgetAmount} ${parsed.data.currency} (${parsed.data.budgetType})`,
      creativeCount: approved.length,
    },
  });
  after(() => executeCampaignPlan(plan.id));
  revalidatePath(`/app/brands/${brandId}/campaigns`);
  return {};
}
