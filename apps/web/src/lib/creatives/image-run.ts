import "server-only";
import { prisma } from "@adscore/db";
import { AiBlockedError, generateImage } from "@adscore/ai";
import { audit } from "@/lib/audit";

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
    // Baytlar DB'de: Vercel'de kalıcı disk yok; S3 geçişi production ölçeğinde
    await prisma.creativeImage.update({
      where: { id: imageId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        data: Buffer.from(result.imageBase64, "base64"),
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
