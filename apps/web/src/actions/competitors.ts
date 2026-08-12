"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma, type CompetitorType } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  executeAdAnalysis,
  executePatternAnalysis,
  MIN_ADS_FOR_PATTERNS,
} from "@/lib/competitors/run";

export type CompetitorFormState = { error?: string; success?: boolean };

const COMPETITOR_TYPES = [
  "DIRECT",
  "INDIRECT",
  "ASPIRATIONAL",
  "CREATIVE",
] as const;

async function requireOwnedBrand(brandId: string) {
  const user = await requireUser();
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspace: { ownerId: user.id } },
  });
  if (!brand) return null;
  return { user, brand };
}

const competitorSchema = z.object({
  name: z.string().min(2, "Rakip adı en az 2 karakter olmalı.").max(120),
  website: z
    .union([z.literal(""), z.url("Geçerli bir URL gir (https:// ile).")])
    .optional(),
  type: z.enum(COMPETITOR_TYPES),
  note: z.string().max(500).optional(),
  addedFrom: z.enum(["user", "research"]).optional(),
});

export async function addCompetitor(
  brandId: string,
  _prev: CompetitorFormState,
  formData: FormData,
): Promise<CompetitorFormState> {
  const owned = await requireOwnedBrand(brandId);
  if (!owned) return { error: "Marka bulunamadı." };
  const parsed = competitorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  const competitor = await prisma.competitor.create({
    data: {
      brandId,
      name: parsed.data.name,
      website: parsed.data.website || null,
      type: parsed.data.type as CompetitorType,
      note: parsed.data.note || null,
      addedFrom: parsed.data.addedFrom ?? "user",
    },
  });
  await audit({
    workspaceId: owned.brand.workspaceId,
    userId: owned.user.id,
    action: "competitor.add",
    entity: "competitor",
    entityId: competitor.id,
    newState: { name: competitor.name, type: competitor.type },
  });
  revalidatePath(`/app/brands/${brandId}/competitors`);
  revalidatePath(`/app/brands/${brandId}`);
  return { success: true };
}

export async function deleteCompetitor(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("competitorId") ?? "");
  const competitor = await prisma.competitor.findFirst({
    where: { id, brand: { workspace: { ownerId: user.id } } },
    include: { brand: true },
  });
  if (!competitor) return;
  await prisma.competitor.delete({ where: { id } });
  await audit({
    workspaceId: competitor.brand.workspaceId,
    userId: user.id,
    action: "competitor.delete",
    entity: "competitor",
    entityId: id,
    previousState: { name: competitor.name },
  });
  revalidatePath(`/app/brands/${competitor.brandId}/competitors`);
}

const adSchema = z.object({
  inputText: z
    .string()
    .min(40, "Reklam metni/tarifi en az 40 karakter olmalı (analiz için yeterli içerik gerekir).")
    .max(8000),
  inputUrl: z
    .union([z.literal(""), z.url("Geçerli bir URL gir (https:// ile).")])
    .optional(),
});

export async function addCompetitorAd(
  competitorId: string,
  _prev: CompetitorFormState,
  formData: FormData,
): Promise<CompetitorFormState> {
  const user = await requireUser();
  const competitor = await prisma.competitor.findFirst({
    where: { id: competitorId, brand: { workspace: { ownerId: user.id } } },
    include: { brand: true },
  });
  if (!competitor) return { error: "Rakip bulunamadı." };
  const parsed = adSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  const ad = await prisma.competitorAd.create({
    data: {
      competitorId,
      inputText: parsed.data.inputText,
      inputUrl: parsed.data.inputUrl || null,
    },
  });
  await audit({
    workspaceId: competitor.brand.workspaceId,
    userId: user.id,
    action: "competitor_ad.add",
    entity: "competitor_ad",
    entityId: ad.id,
  });
  after(() => executeAdAnalysis(ad.id));
  revalidatePath(`/app/brands/${competitor.brandId}/competitors`);
  return { success: true };
}

export async function startPatternAnalysis(
  brandId: string,
  _prev: CompetitorFormState,
  _formData: FormData,
): Promise<CompetitorFormState> {
  const owned = await requireOwnedBrand(brandId);
  if (!owned) return { error: "Marka bulunamadı." };

  const analyzedCount = await prisma.competitorAd.count({
    where: { competitor: { brandId }, status: "COMPLETED" },
  });
  if (analyzedCount < MIN_ADS_FOR_PATTERNS) {
    return {
      error: `Pattern analizi için en az ${MIN_ADS_FOR_PATTERNS} analiz edilmiş reklam gerekir (şu an ${analyzedCount}).`,
    };
  }
  const active = await prisma.patternAnalysis.findFirst({
    where: { brandId, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (active) return { error: "Zaten süren bir pattern analizi var." };

  const pattern = await prisma.patternAnalysis.create({
    data: { brandId, adCount: analyzedCount },
  });
  await audit({
    workspaceId: owned.brand.workspaceId,
    userId: owned.user.id,
    action: "pattern_analysis.start",
    entity: "pattern_analysis",
    entityId: pattern.id,
  });
  after(() => executePatternAnalysis(pattern.id));
  revalidatePath(`/app/brands/${brandId}/competitors`);
  return {};
}
