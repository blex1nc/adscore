"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  COPY_LANGUAGE_CODES,
  CURRENCY_CODES,
  MARKET_CODES,
} from "@/lib/options";

export type BrandFormState = { error?: string; success?: boolean };

const brandSchema = z.object({
  name: z.string().min(2, "Marka adı en az 2 karakter olmalı.").max(120),
  website: z
    .union([z.literal(""), z.url("Geçerli bir URL gir (https:// ile).")])
    .optional(),
  description: z.string().max(2000).optional(),
  targetMarket: z
    .union([z.literal(""), z.enum(MARKET_CODES as [string, ...string[]])])
    .optional(),
  currency: z
    .union([z.literal(""), z.enum(CURRENCY_CODES as [string, ...string[]])])
    .optional(),
  copyLanguage: z
    .union([
      z.literal(""),
      z.enum(COPY_LANGUAGE_CODES as [string, ...string[]]),
    ])
    .optional(),
});

function toData(values: z.infer<typeof brandSchema>) {
  return {
    name: values.name,
    website: values.website || null,
    description: values.description || null,
    targetMarket: values.targetMarket || null,
    currency: values.currency || null,
    copyLanguage: values.copyLanguage || null,
  };
}

export async function createBrand(
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const user = await requireUser();
  if (!user.workspace) return { error: "Workspace bulunamadı." };
  const parsed = brandSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  const brand = await prisma.brand.create({
    data: { ...toData(parsed.data), workspaceId: user.workspace.id },
  });
  await audit({
    workspaceId: user.workspace.id,
    userId: user.id,
    action: "brand.create",
    entity: "brand",
    entityId: brand.id,
    newState: toData(parsed.data),
  });
  revalidatePath("/app/brands");
  redirect(`/app/brands/${brand.id}`);
}

export async function updateBrand(
  brandId: string,
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const user = await requireUser();
  // Tenant izolasyonu: marka bu kullanıcının workspace'inde olmalı
  const existing = await prisma.brand.findFirst({
    where: { id: brandId, workspace: { ownerId: user.id } },
  });
  if (!existing) return { error: "Marka bulunamadı." };
  const parsed = brandSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  await prisma.brand.update({
    where: { id: existing.id },
    data: toData(parsed.data),
  });
  await audit({
    workspaceId: existing.workspaceId,
    userId: user.id,
    action: "brand.update",
    entity: "brand",
    entityId: existing.id,
    previousState: {
      name: existing.name,
      website: existing.website,
      description: existing.description,
      targetMarket: existing.targetMarket,
      currency: existing.currency,
      copyLanguage: existing.copyLanguage,
    },
    newState: toData(parsed.data),
  });
  revalidatePath("/app/brands");
  revalidatePath(`/app/brands/${existing.id}`);
  return { success: true };
}

export async function deleteBrand(formData: FormData) {
  const user = await requireUser();
  const brandId = String(formData.get("brandId") ?? "");
  const existing = await prisma.brand.findFirst({
    where: { id: brandId, workspace: { ownerId: user.id } },
  });
  if (!existing) return;
  await prisma.brand.delete({ where: { id: existing.id } });
  await audit({
    workspaceId: existing.workspaceId,
    userId: user.id,
    action: "brand.delete",
    entity: "brand",
    entityId: existing.id,
    previousState: { name: existing.name },
  });
  revalidatePath("/app/brands");
  redirect("/app/brands");
}
