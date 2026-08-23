import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";

// Marka asset'leri (logo/ürün görseli) auth + tenant kontrolüyle DB'den servis
// edilir — /api/creative-images/[id] deseniyle birebir. Yüklemede yalnız
// PNG/JPEG/WebP kabul edildiği ve MIME imza baytlarıyla doğrulandığı için
// saklanan mimeType güvenle kullanılır; nosniff ile tarayıcı tahmini kapatılır.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const asset = await prisma.brandAsset.findFirst({
    where: { id, brand: { workspace: { ownerId: user.id } } },
    select: { data: true, mimeType: true },
  });
  if (!asset) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(asset.data), {
    headers: {
      "content-type": asset.mimeType,
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
}
