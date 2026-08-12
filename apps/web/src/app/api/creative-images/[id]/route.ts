import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { IMAGE_DIR } from "@/lib/creatives/image-run";

// Görseller auth + tenant kontrolüyle servis edilir (public dizinde değil)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const image = await prisma.creativeImage.findFirst({
    where: {
      id,
      creative: { brand: { workspace: { ownerId: user.id } } },
      status: "COMPLETED",
    },
  });
  if (!image?.filePath) return new NextResponse("Not found", { status: 404 });

  // Path traversal önlemi: yalnızca kayıtta duran dosya adı, dizin sabit
  const safeName = path.basename(image.filePath);
  try {
    const data = await readFile(path.join(IMAGE_DIR, safeName));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "content-type": image.mimeType ?? "image/png",
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
