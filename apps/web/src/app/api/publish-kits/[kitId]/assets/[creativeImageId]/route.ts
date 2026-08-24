import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { findOwnedKit, readKit } from "@/lib/publish-kit/access";
import { imageSpec, slugify } from "@/lib/publish-kit/build";
import type { KitRatio } from "@/lib/publish-kit/types";

export const maxDuration = 30;

const RATIOS: KitRatio[] = ["1x1", "4x5", "9x16"];

// GET /api/publish-kits/[kitId]/assets/[creativeImageId]?ratio=1x1|4x5|9x16[&download=1]
// Kit → plan → marka → workspace.ownerId zinciri; görsel kitin asset listesinde olmalı.
// CreativeImage.data cover-crop + resize ile istenen orana getirilir (JPEG).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kitId: string; creativeImageId: string }> },
) {
  const { kitId, creativeImageId } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const ratioParam = request.nextUrl.searchParams.get("ratio") ?? "1x1";
  const ratio = RATIOS.find((r) => r === ratioParam);
  if (!ratio) return new NextResponse("ratio=1x1|4x5|9x16", { status: 400 });

  const record = await findOwnedKit(kitId, user.id);
  const kit = record ? readKit(record.kit) : null;
  if (!record || !kit) return new NextResponse("Not found", { status: 404 });
  if (!kit.assets.some((a) => a.creativeImageId === creativeImageId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const image = await prisma.creativeImage.findFirst({
    where: {
      id: creativeImageId,
      status: "COMPLETED",
      creative: { brand: { workspace: { ownerId: user.id } } },
    },
    select: { data: true, creative: { select: { headline: true } } },
  });
  if (!image?.data) return new NextResponse("Not found", { status: 404 });

  const spec = imageSpec(ratio);
  let out: Buffer;
  try {
    out = await sharp(Buffer.from(image.data))
      .rotate() // EXIF yönelimini uygula
      .resize(spec.width, spec.height, { fit: "cover", position: "centre" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  } catch {
    return new NextResponse("Görsel işlenemedi.", { status: 422 });
  }

  const filename = `${slugify(record.plan.brand.name)}-${slugify(image.creative.headline)}-${ratio}.jpg`;
  const download = request.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(out), {
    headers: {
      "content-type": "image/jpeg",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "cache-control": "private, max-age=300",
      "x-asset-spec": `${spec.width}x${spec.height}${spec.estimate ? ";estimate" : ""}`,
    },
  });
}
