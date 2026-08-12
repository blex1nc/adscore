"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@adscore/db";
import { createSessionCookie, destroySession, getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type AuthFormState = { error?: string };

function safeNext(next: unknown) {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

const loginSchema = z.object({
  email: z.email("Geçerli bir e-posta gir."),
  password: z.string().min(1, "Şifre gerekli."),
  next: z.string().optional(),
});

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  // Kullanıcı yok ve şifre yanlış aynı mesajı verir (enumeration önlemi)
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "E-posta veya şifre hatalı." };
  }
  await createSessionCookie({ sub: user.id, role: user.platformRole });
  const next = safeNext(parsed.data.next);
  redirect(next ?? (user.platformRole === "ADMIN" ? "/admin" : "/app"));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

const signupSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2, "İsim en az 2 karakter olmalı."),
  email: z.email("Geçerli bir e-posta gir."),
  password: z.string().min(10, "Şifre en az 10 karakter olmalı."),
});

export async function signupWithInvite(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  const { token, name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
    return { error: "Davet geçersiz veya süresi dolmuş." };
  }
  if (invitation.email && invitation.email.toLowerCase() !== email) {
    return { error: "Bu davet başka bir e-posta adresi için oluşturulmuş." };
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "Bu e-posta ile bir hesap zaten var." };
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 12),
        workspace: { create: { name: `${name} Workspace` } },
      },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date(), usedById: created.id },
    });
    return created;
  });

  await audit({
    userId: user.id,
    action: "user.signup_with_invite",
    entity: "invitation",
    entityId: invitation.id,
  });
  await createSessionCookie({ sub: user.id, role: user.platformRole });
  redirect("/app");
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mevcut şifre gerekli."),
  newPassword: z.string().min(10, "Yeni şifre en az 10 karakter olmalı."),
});

export async function changePassword(
  _prev: AuthFormState & { success?: boolean },
  formData: FormData,
): Promise<AuthFormState & { success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return { error: "Mevcut şifre hatalı." };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) },
  });
  await audit({ userId: user.id, action: "user.change_password" });
  return { success: true };
}
