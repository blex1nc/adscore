// A6 — Meta webhook ucu.
// GET: doğrulama (hub.mode=subscribe + hub.verify_token eşleşmesi → hub.challenge aynen döner).
// POST: X-Hub-Signature-256 imza kontrolü (sha256=HMAC-SHA256(HAM gövde, app_secret)).
// Kaynak: SOURCES-A #12. Not: imza HAM gövde üzerinden doğrulanır — önce text(), sonra parse.
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getMetaAppCredentials, getWebhookVerifyToken } from "@/lib/meta/env";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const verifyToken = getWebhookVerifyToken();
  if (
    q.get("hub.mode") === "subscribe" &&
    verifyToken &&
    q.get("hub.verify_token") === verifyToken &&
    q.get("hub.challenge")
  ) {
    return new NextResponse(q.get("hub.challenge"), { status: 200 });
  }
  return new NextResponse("Doğrulama başarısız", { status: 403 });
}

export async function POST(req: NextRequest) {
  const creds = getMetaAppCredentials();
  if (!creds) return new NextResponse(null, { status: 503 });

  const raw = await req.text();
  const header = req.headers.get("x-hub-signature-256") ?? "";
  if (!header.startsWith("sha256=")) {
    return new NextResponse(null, { status: 401 });
  }
  const expected = createHmac("sha256", creds.appSecret)
    .update(raw)
    .digest("hex");
  const got = header.slice("sha256=".length);
  const a = Buffer.from(got, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new NextResponse(null, { status: 401 });
  }

  // Meta 36 saat boyunca retry eder — hızlı 200 + kayıt (dedupe teşhis için audit'te)
  let objectType = "bilinmiyor";
  try {
    const body = JSON.parse(raw);
    if (typeof body.object === "string") objectType = body.object;
  } catch {
    // gövde parse edilemese bile imza doğruysa 200 döneriz
  }
  await audit({
    action: "meta.webhook",
    entity: "MetaWebhook",
    newState: { object: objectType, receivedAt: new Date().toISOString() },
  });
  return new NextResponse(null, { status: 200 });
}
