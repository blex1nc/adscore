// Edge-safe session yardımcıları (proxy.ts de kullanır; Prisma/Node API'si yok)
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "adscore_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 gün

export type SessionPayload = { sub: string; role: "ADMIN" | "USER" };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET tanımlı değil (.env.local)");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      role: payload.role === "ADMIN" ? "ADMIN" : "USER",
    };
  } catch {
    return null;
  }
}
