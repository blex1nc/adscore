"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  buildImagePrompt,
  executeImageGeneration,
} from "@/lib/creatives/image-run";

export type ImageFormState = { error?: string };

export async function generateCreativeImage(
  creativeId: string,
  _prev: ImageFormState,
  _formData: FormData,
): Promise<ImageFormState> {
  const user = await requireUser();
  const creative = await prisma.creative.findFirst({
    where: { id: creativeId, brand: { workspace: { ownerId: user.id } } },
    include: { brand: true },
  });
  if (!creative) return { error: "Creative bulunamadı." };

  const active = await prisma.creativeImage.findFirst({
    where: { creativeId, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (active) return { error: "Bu creative için zaten süren bir üretim var." };

  const image = await prisma.creativeImage.create({
    data: {
      creativeId,
      prompt: buildImagePrompt({
        brandName: creative.brand.name,
        brandDescription: creative.brand.description,
        strategy: creative.strategy,
        hook: creative.hook,
        headline: creative.headline,
      }),
    },
  });
  await audit({
    workspaceId: creative.brand.workspaceId,
    userId: user.id,
    action: "creative_image.start",
    entity: "creative_image",
    entityId: image.id,
  });
  after(() => executeImageGeneration(image.id));
  revalidatePath(`/app/brands/${creative.brandId}/creatives`);
  return {};
}
