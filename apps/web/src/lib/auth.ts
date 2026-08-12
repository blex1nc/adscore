import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@adscore/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySessionToken,
  type SessionPayload,
} from "./session";

export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.sub },
    include: { workspace: true },
  });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Oturum bulunamadı");
  return user;
}

export async function createSessionCookie(payload: SessionPayload) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
