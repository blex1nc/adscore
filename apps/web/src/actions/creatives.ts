"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { executeCreativeGeneration } from "@/lib/creatives/run";

export type CreativeFormState = { error?: string; success?: boolean };

async function requireOwnedBrand(brandId: string) {
  const user = await requireUser();
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspace: { ownerId: user.id } },
  });
  if (!brand) return null;
  return { user, brand };
}

const generateSchema = z.object({
  instruction: z.string().max(500).optional(),
  offer: z.string().max(200).optional(),
});

export async function startCreativeGeneration(
  brandId: string,
  _prev: CreativeFormState,
  formData: FormData,
): Promise<CreativeFormState> {
  const owned = await requireOwnedBrand(brandId);
  if (!owned) return { error: "Marka bulunamadı." };

  const research = await prisma.researchRun.findFirst({
    where: { brandId, status: "COMPLETED" },
  });
  if (!research) {
    return {
      error:
        "Önce marka araştırması gerekli: copy üretimi araştırma verisine dayanır, veri olmadan üretim yapılmaz.",
    };
  }
  const active = await prisma.creativeGeneration.findFirst({
    where: { brandId, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (active) return { error: "Zaten süren bir üretim var." };

  const parsed = generateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }

  const generation = await prisma.creativeGeneration.create({
    data: {
      brandId,
      instruction: parsed.data.instruction || null,
      offer: parsed.data.offer || null,
    },
  });
  await audit({
    workspaceId: owned.brand.workspaceId,
    userId: owned.user.id,
    action: "creative_generation.start",
    entity: "creative_generation",
    entityId: generation.id,
    newState: { offer: parsed.data.offer || null },
  });
  after(() => executeCreativeGeneration(generation.id));
  revalidatePath(`/app/brands/${brandId}/creatives`);
  return {};
}

async function setApproval(
  formData: FormData,
  approval: "APPROVED" | "REJECTED" | "PENDING",
  action: string,
) {
  const user = await requireUser();
  const id = String(formData.get("creativeId") ?? "");
  const creative = await prisma.creative.findFirst({
    where: { id, brand: { workspace: { ownerId: user.id } } },
    include: { brand: true },
  });
  if (!creative) return;
  await prisma.creative.update({ where: { id }, data: { approval } });
  await audit({
    workspaceId: creative.brand.workspaceId,
    userId: user.id,
    action,
    entity: "creative",
    entityId: id,
    previousState: { approval: creative.approval },
    newState: { approval },
  });
  revalidatePath(`/app/brands/${creative.brandId}/creatives`);
}

export async function approveCreative(formData: FormData) {
  await setApproval(formData, "APPROVED", "creative.approve");
}

export async function rejectCreative(formData: FormData) {
  await setApproval(formData, "REJECTED", "creative.reject");
}

export async function resetCreativeApproval(formData: FormData) {
  await setApproval(formData, "PENDING", "creative.reset_approval");
}

const editSchema = z.object({
  primaryText: z.string().min(10, "Primary text çok kısa.").max(2000),
  headline: z.string().min(2, "Başlık gerekli.").max(120),
  description: z.string().max(200).optional(),
  cta: z.string().min(2, "CTA gerekli.").max(40),
});

export async function updateCreative(
  creativeId: string,
  _prev: CreativeFormState,
  formData: FormData,
): Promise<CreativeFormState> {
  const user = await requireUser();
  const creative = await prisma.creative.findFirst({
    where: { id: creativeId, brand: { workspace: { ownerId: user.id } } },
    include: { brand: true },
  });
  if (!creative) return { error: "Creative bulunamadı." };
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  await prisma.creative.update({
    where: { id: creative.id },
    data: {
      primaryText: parsed.data.primaryText,
      headline: parsed.data.headline,
      description: parsed.data.description || null,
      cta: parsed.data.cta,
      editedAt: new Date(),
      // Düzenlenen creative yeniden onaya düşer
      approval: "PENDING",
    },
  });
  await audit({
    workspaceId: creative.brand.workspaceId,
    userId: user.id,
    action: "creative.edit",
    entity: "creative",
    entityId: creative.id,
    previousState: {
      primaryText: creative.primaryText,
      headline: creative.headline,
      cta: creative.cta,
    },
    newState: parsed.data,
  });
  revalidatePath(`/app/brands/${creative.brandId}/creatives`);
  return { success: true };
}
