// A2 — OAuth callback: state doğrula → kod → uzun ömürlü token →
// debug_token ile GERÇEK izinler → MetaConnection (şifreli) → panele dön.
// Uçlar: SOURCES-A #3, #5, #6.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@adscore/db";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { getMetaAppCredentials } from "@/lib/meta/env";
import {
  META_OAUTH_STATE_COOKIE,
  debugToken,
  exchangeCode,
  exchangeLongLived,
  missingScopes,
  verifyOauthState,
} from "@/lib/meta/oauth";
import { saveConnection } from "@/lib/meta/token-store";

function backToSettings(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/app/settings/meta", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.delete(META_OAUTH_STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!user.workspace) return backToSettings(req, { meta_hata: "workspace" });

  const creds = getMetaAppCredentials();
  if (!creds) return backToSettings(req, { meta_hata: "env" });

  const q = req.nextUrl.searchParams;

  // Kullanıcı reddi — sessiz başarı yok, dürüst mesaj (SOURCES-A #3: error_reason=user_denied)
  if (q.get("error") || q.get("error_reason")) {
    return backToSettings(req, {
      meta_hata: q.get("error_reason") === "user_denied" ? "reddedildi" : "meta",
    });
  }

  // State: hem imza hem cookie eşleşmesi (CSRF)
  const state = q.get("state") ?? "";
  const cookieState = req.cookies.get(META_OAUTH_STATE_COOKIE)?.value ?? "";
  if (
    !state ||
    state !== cookieState ||
    !verifyOauthState(state, creds.appSecret)
  ) {
    return backToSettings(req, { meta_hata: "state" });
  }

  const code = q.get("code");
  if (!code) return backToSettings(req, { meta_hata: "kod" });

  try {
    const redirectUri = new URL("/api/meta/oauth/callback", req.url).toString();
    const shortLived = await exchangeCode({
      appId: creds.appId,
      appSecret: creds.appSecret,
      redirectUri,
      code,
    });
    const longLived = await exchangeLongLived({
      appId: creds.appId,
      appSecret: creds.appSecret,
      shortLivedToken: shortLived.access_token,
    });

    // GERÇEK izin listesi: izin ekranında kaldırılanlar burada görünür (A2 gereği)
    const info = await debugToken({
      appId: creds.appId,
      appSecret: creds.appSecret,
      inputToken: longLived.access_token,
    });
    if (info.is_valid === false || !info.user_id) {
      return backToSettings(req, { meta_hata: "dogrulama" });
    }
    const scopes = info.scopes ?? [];
    const expiresAt =
      info.expires_at && info.expires_at > 0
        ? new Date(info.expires_at * 1000)
        : longLived.expires_in
          ? new Date(Date.now() + longLived.expires_in * 1000)
          : null;

    // Yeniden bağlanma mı, ilk bağlanma mı? (audit: meta.connect / meta.reauth)
    const existing = await prisma.metaConnection.findUnique({
      where: { workspaceId: user.workspace.id },
      select: { id: true },
    });
    await saveConnection({
      workspaceId: user.workspace.id,
      metaUserId: info.user_id,
      accessToken: longLived.access_token,
      expiresAt,
      scopes,
    });
    await audit({
      workspaceId: user.workspace.id,
      userId: user.id,
      action: existing ? "meta.reauth" : "meta.connect",
      entity: "MetaConnection",
      newState: { scopes, expiresAt: expiresAt?.toISOString() ?? null },
    });

    const missing = missingScopes(scopes);
    return backToSettings(
      req,
      missing.length > 0
        ? { meta_eksik_izin: missing.join(",") }
        : { meta_baglandi: "1" },
    );
  } catch {
    // Teknik detay loglanmaz (token/kod sızıntısı riski); kullanıcıya dürüst genel mesaj.
    return backToSettings(req, { meta_hata: "degisim" });
  }
}
