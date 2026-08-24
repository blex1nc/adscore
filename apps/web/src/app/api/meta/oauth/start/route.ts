// A2 — OAuth başlangıcı: state (CSRF) üret, httpOnly cookie'ye yaz, Meta'ya yönlendir.
// Dialog parametreleri: SOURCES-A #3/#4.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLoginConfigId, getMetaAppCredentials } from "@/lib/meta/env";
import {
  META_OAUTH_STATE_COOKIE,
  buildAuthUrl,
  createOauthState,
} from "@/lib/meta/oauth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!user.workspace) {
    return NextResponse.redirect(
      new URL("/app/settings/meta?meta_hata=workspace", req.url),
    );
  }

  const creds = getMetaAppCredentials();
  if (!creds) {
    // Çalışmayan buton yok: ekran zaten BLOCKED gösterir, buraya gelinirse dürüst dönüş.
    return NextResponse.redirect(
      new URL("/app/settings/meta?meta_hata=env", req.url),
    );
  }

  const state = createOauthState(creds.appSecret);
  const redirectUri = new URL("/api/meta/oauth/callback", req.url).toString();
  const authUrl = buildAuthUrl({
    appId: creds.appId,
    redirectUri,
    state,
    configId: getLoginConfigId(),
  });

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(META_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/meta/oauth",
    maxAge: 600,
  });
  return res;
}
