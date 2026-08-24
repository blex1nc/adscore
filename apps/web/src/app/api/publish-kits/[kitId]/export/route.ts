import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findOwnedKit, readChecklist, readKit } from "@/lib/publish-kit/access";
import { renderKitHtml } from "@/lib/publish-kit/export-html";
import { renderKitSheet } from "@/lib/publish-kit/export-sheet";
import { slugify } from "@/lib/publish-kit/build";
import { prisma } from "@adscore/db";

// GET /api/publish-kits/[kitId]/export?format=json|html|sheet — auth + tenant (404)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kitId: string }> },
) {
  const { kitId } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const record = await findOwnedKit(kitId, user.id);
  const kit = record ? readKit(record.kit) : null;
  if (!record || !kit) return new NextResponse("Not found", { status: 404 });

  const format = request.nextUrl.searchParams.get("format") ?? "json";
  const base = `${slugify(record.plan.brand.name)}-kurulum-kiti-v${record.version}`;

  if (format === "json") {
    const payload = {
      kitId: record.id,
      version: record.version,
      brand: record.plan.brand.name,
      planId: record.planId,
      publishedAt: record.plan.publishedAt?.toISOString() ?? null,
      publishNote: record.plan.publishNote,
      checklist: readChecklist(record.checklist),
      kit,
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${base}.json"`,
        "cache-control": "private, no-store",
      },
    });
  }

  if (format === "html") {
    const html = renderKitHtml(kit, {
      brandName: record.plan.brand.name,
      version: record.version,
      checklist: readChecklist(record.checklist),
      exportedAt: new Date(),
      publishedAt: record.plan.publishedAt,
      publishNote: record.plan.publishNote,
    });
    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
      },
    });
  }

  if (format === "sheet") {
    const brand = await prisma.brand.findUnique({
      where: { id: record.plan.brandId },
      select: { targetMarket: true },
    });
    const csv = renderKitSheet(kit, {
      brandName: record.plan.brand.name,
      countryCode: brand?.targetMarket ?? null,
    });
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${base}-ads-manager-import.csv"`,
        "cache-control": "private, no-store",
      },
    });
  }

  return new NextResponse("format=json|html|sheet", { status: 400 });
}
