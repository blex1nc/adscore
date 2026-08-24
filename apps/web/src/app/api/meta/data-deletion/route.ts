// A6 — Veri silme talebi ucu: bağlantıyı ve Meta önbelleğini siler,
// Meta'nın beklediği ZORUNLU formatta cevap döner: { url, confirmation_code }.
// Kaynak: SOURCES-A #14, #15.
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@adscore/db";
import { audit } from "@/lib/audit";
import { getMetaAppCredentials } from "@/lib/meta/env";
import { parseSignedRequest } from "@/lib/meta/signed-request";

export async function POST(req: NextRequest) {
  const creds = getMetaAppCredentials();
  if (!creds) return new NextResponse(null, { status: 503 });

  const form = await req.formData().catch(() => null);
  const signedRequest = form?.get("signed_request");
  if (typeof signedRequest !== "string") {
    return new NextResponse(null, { status: 400 });
  }
  const payload = parseSignedRequest(signedRequest, creds.appSecret);
  if (!payload?.user_id) return new NextResponse(null, { status: 401 });

  // Bağlantı silinince MetaAdAccount + BrandMetaBinding cascade ile gider (şema).
  const conns = await prisma.metaConnection.findMany({
    where: { metaUserId: payload.user_id },
    select: { id: true, workspaceId: true },
  });
  for (const c of conns) {
    await prisma.metaConnection.delete({ where: { id: c.id } });
  }

  const code = `msil_${randomBytes(8).toString("hex")}`;
  // Durum sayfası audit kaydından beslenir (yeni model açılmadı).
  await audit({
    action: "meta.data_deletion",
    entity: "MetaConnection",
    entityId: code,
    newState: {
      metaUserId: payload.user_id,
      deletedConnections: conns.length,
      deletedAt: new Date().toISOString(),
    },
  });

  const statusUrl = new URL(
    `/api/meta/data-deletion/status?code=${code}`,
    req.url,
  ).toString();
  return NextResponse.json({ url: statusUrl, confirmation_code: code });
}
