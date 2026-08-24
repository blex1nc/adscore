"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { buildKit } from "@/lib/publish-kit/build";
import {
  findOwnedKit,
  loadBuilderSource,
  readKit,
  toBuilderInput,
} from "@/lib/publish-kit/access";
import type { KitInputs } from "@/lib/publish-kit/types";

// CONTRACTS §4 — imzalar sabit (Ajan C wizard'ı bunları çağırır)
export type KitFormState = { error?: string; success?: boolean; kitId?: string };

function kitPath(brandId: string, planId: string) {
  return `/app/brands/${brandId}/campaigns/${planId}/kit`;
}

const inputsSchema = z.object({
  facebookPage: z.string().trim().max(120).optional(),
  instagramAccount: z.string().trim().max(120).optional(),
  destinationUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine(
      (v) => !v || /^https?:\/\/\S+$/i.test(v),
      "Hedef URL http(s):// ile başlamalı.",
    ),
  pixelDataset: z.string().trim().max(120).optional(),
  conversionEvent: z.string().trim().max(80).optional(),
  adsManagerCampaignName: z.string().trim().max(200).optional(),
});

function cleanInputs(raw: z.infer<typeof inputsSchema>): KitInputs {
  const out: KitInputs = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v) out[k as keyof KitInputs] = v;
  }
  return out;
}

// Kapılar: sahiplik, plan COMPLETED, ≥1 APPROVED creative. Her çağrı yeni version;
// önceki kitin kullanıcı girdileri (Sayfa, pixel, URL...) yeni kite taşınır.
export async function buildPublishKit(planId: string): Promise<KitFormState> {
  const user = await requireUser();
  const source = await loadBuilderSource(planId, user.id);
  if (!source) return { error: "Plan bulunamadı." };
  if (source.status !== "COMPLETED") {
    return { error: "Kit yalnız tamamlanmış (COMPLETED) plandan üretilir." };
  }
  if (source.creatives.length === 0) {
    return {
      error:
        "Kit için onaylı creative gerekli: Creative Studio'da en az bir varyantı onayla.",
    };
  }

  const previous = source.kits[0];
  const carried = readKit(previous?.kit)?.inputs ?? {};

  let kit;
  try {
    kit = buildKit(toBuilderInput(source, carried));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Kit üretilemedi." };
  }

  const record = await prisma.publishKit.create({
    data: {
      planId: source.id,
      version: (previous?.version ?? 0) + 1,
      kit: kit as unknown as Prisma.InputJsonValue,
    },
  });
  await audit({
    workspaceId: source.brand.workspaceId,
    userId: user.id,
    action: "publish_kit.built",
    entity: "publish_kit",
    entityId: record.id,
    newState: {
      planId: source.id,
      version: record.version,
      adsets: kit.adsets.length,
      ads: kit.adsets.reduce((n, a) => n + a.ads.length, 0),
      assets: kit.assets.length,
      gaps: kit.gaps.length,
    },
  });
  revalidatePath(kitPath(source.brandId, source.id));
  revalidatePath(`/app/brands/${source.brandId}/campaigns`);
  return { success: true, kitId: record.id };
}

// Kullanıcının Ads Manager'da işaretlediği adım (kitId, stepId, checked)
export async function toggleKitStep(formData: FormData): Promise<void> {
  const user = await requireUser();
  const kitId = String(formData.get("kitId") ?? "");
  const stepId = String(formData.get("stepId") ?? "").slice(0, 120);
  const checked = String(formData.get("checked") ?? "") === "true";
  if (!kitId || !stepId) return;

  const kit = await findOwnedKit(kitId, user.id);
  if (!kit) return;
  const validStep = readKit(kit.kit)?.sections.some((s) =>
    s.steps.some((st) => st.id === stepId),
  );
  if (!validStep) return;

  const current =
    kit.checklist && typeof kit.checklist === "object"
      ? { ...(kit.checklist as Record<string, boolean>) }
      : {};
  if (checked) current[stepId] = true;
  else delete current[stepId];

  await prisma.publishKit.update({
    where: { id: kitId },
    data: { checklist: current as Prisma.InputJsonValue },
  });
  await audit({
    workspaceId: kit.plan.brand.workspaceId,
    userId: user.id,
    action: "publish_kit.step_toggled",
    entity: "publish_kit",
    entityId: kitId,
    newState: { stepId, checked },
  });
  revalidatePath(kitPath(kit.plan.brandId, kit.planId));
}

// "Ads Manager'da yayınladım" — plan üzerinde publishedAt + opsiyonel not
export async function markPlanPublished(formData: FormData): Promise<void> {
  const user = await requireUser();
  const planId = String(formData.get("planId") ?? "");
  const publishNote = String(formData.get("publishNote") ?? "")
    .trim()
    .slice(0, 300);
  if (!planId) return;

  const plan = await prisma.campaignPlan.findFirst({
    where: { id: planId, brand: { workspace: { ownerId: user.id } } },
    select: {
      id: true,
      brandId: true,
      status: true,
      publishedAt: true,
      publishNote: true,
      brand: { select: { workspaceId: true } },
    },
  });
  if (!plan || plan.status !== "COMPLETED") return;

  const now = new Date();
  await prisma.campaignPlan.update({
    where: { id: planId },
    data: {
      publishedAt: plan.publishedAt ?? now, // ilk yayın tarihi korunur
      publishNote: publishNote || plan.publishNote,
    },
  });
  await audit({
    workspaceId: plan.brand.workspaceId,
    userId: user.id,
    action: "publish_kit.published",
    entity: "campaign_plan",
    entityId: planId,
    previousState: {
      publishedAt: plan.publishedAt?.toISOString() ?? null,
      publishNote: plan.publishNote,
    },
    newState: {
      publishedAt: (plan.publishedAt ?? now).toISOString(),
      publishNote: publishNote || plan.publishNote,
    },
  });
  revalidatePath(kitPath(plan.brandId, planId));
  revalidatePath(`/app/brands/${plan.brandId}/campaigns`);
  revalidatePath(`/app/brands/${plan.brandId}`);
}

// Kullanıcı girdileri (Sayfa, Instagram, hedef URL, pixel, event) — kit aynı
// versiyonda, plan + güncel onaylı creative'lerden deterministik yeniden üretilir.
export async function updateKitInputs(
  kitId: string,
  _prev: KitFormState,
  formData: FormData,
): Promise<KitFormState> {
  const user = await requireUser();
  const existing = await findOwnedKit(kitId, user.id);
  if (!existing) return { error: "Kit bulunamadı." };

  const parsed = inputsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  const inputs = cleanInputs(parsed.data);

  const source = await loadBuilderSource(existing.planId, user.id);
  if (!source || source.status !== "COMPLETED") return { error: "Plan bulunamadı." };
  if (source.creatives.length === 0) {
    return { error: "Onaylı creative kalmadı; kit güncellenemez." };
  }

  let kit;
  try {
    kit = buildKit(toBuilderInput(source, inputs));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Kit güncellenemedi." };
  }

  const previousInputs = readKit(existing.kit)?.inputs ?? {};
  await prisma.publishKit.update({
    where: { id: kitId },
    data: { kit: kit as unknown as Prisma.InputJsonValue },
  });
  await audit({
    workspaceId: existing.plan.brand.workspaceId,
    userId: user.id,
    action: "publish_kit.inputs_updated",
    entity: "publish_kit",
    entityId: kitId,
    previousState: previousInputs as Prisma.InputJsonValue,
    newState: inputs as Prisma.InputJsonValue,
  });
  revalidatePath(kitPath(existing.plan.brandId, existing.planId));
  return { success: true, kitId };
}
