import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@adscore/db";
import { AiBlockedError, generateImage } from "@adscore/ai";
import { audit } from "@/lib/audit";

// Lokal depolama (dev). Production'da S3'e taşınacak.
export const IMAGE_DIR = path.join(process.cwd(), ".data", "creative-images");

export function buildImagePrompt(input: {
  brandName: string;
  brandDescription: string | null;
  strategy: string;
  hook: string;
  headline: string;
}): string {
  return `Meta feed reklamı için kare (1:1) fotoğrafik reklam görseli üret.

Marka: ${input.brandName}${input.brandDescription ? ` (${input.brandDescription})` : ""}
Creative stratejisi: ${input.strategy}
Duygu/kanca: ${input.hook}

Kurallar:
- Görsel ÜZERİNDE hiçbir yazı, logo veya watermark OLMASIN (metin ayrıca ekleniyor).
- Gerçekçi, yüksek kaliteli, sosyal medya reklamına uygun kompozisyon.
- Ürün/deneyim odaklı; stratejideki duyguyu görselleştir.
- Rahatsız edici, yanıltıcı veya abartılı öğe kullanma.`;
}

export async function executeImageGeneration(imageId: string): Promise<void> {
  const image = await prisma.creativeImage.findUnique({
    where: { id: imageId },
    include: { creative: { include: { brand: true } } },
  });
  if (!image || image.status !== "QUEUED") return;

  await prisma.creativeImage.update({
    where: { id: imageId },
    data: { status: "RUNNING" },
  });

  try {
    const result = await generateImage(image.prompt);
    await mkdir(IMAGE_DIR, { recursive: true });
    const ext = result.mimeType === "image/jpeg" ? "jpg" : "png";
    const fileName = `${imageId}.${ext}`;
    await writeFile(
      path.join(IMAGE_DIR, fileName),
      Buffer.from(result.imageBase64, "base64"),
    );
    await prisma.creativeImage.update({
      where: { id: imageId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        filePath: fileName,
        mimeType: result.mimeType,
        model: result.model,
      },
    });
    await audit({
      workspaceId: image.creative.brand.workspaceId,
      action: "creative_image.completed",
      entity: "creative_image",
      entityId: imageId,
    });
  } catch (error) {
    const message =
      error instanceof AiBlockedError
        ? `BLOCKED: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Bilinmeyen hata.";
    await prisma.creativeImage.update({
      where: { id: imageId },
      data: { status: "FAILED", finishedAt: new Date(), error: message },
    });
  }
}
