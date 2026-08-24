// A6 — Deauthorize callback: kullanıcı app'i Meta tarafından kaldırınca
// signed_request içeren POST gelir → bağlantı REVOKED (sessiz kırık bağlantı kalmaz).
// Kaynak: SOURCES-A #13, #14. App Dashboard → Facebook Login → Settings → Deauthorize Callback URL.
import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getMetaAppCredentials } from "@/lib/meta/env";
import { parseSignedRequest } from "@/lib/meta/signed-request";
import { markRevokedByMetaUserId } from "@/lib/meta/token-store";

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

  const affected = await markRevokedByMetaUserId(payload.user_id);
  for (const conn of affected) {
    await audit({
      workspaceId: conn.workspaceId,
      action: "meta.deauthorize",
      entity: "MetaConnection",
      entityId: conn.id,
      previousState: { status: conn.status },
      newState: { status: "REVOKED" },
    });
  }
  return NextResponse.json({ success: true });
}
