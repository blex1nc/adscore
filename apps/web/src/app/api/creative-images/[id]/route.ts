import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";

// Görseller auth + tenant kontrolüyle DB'den servis edilir
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
    select: { data: true, mimeType: true },
  });
  if (!image?.data) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "content-type": image.mimeType ?? "image/png",
      "cache-control": "private, max-age=3600",
    },
  });
}
