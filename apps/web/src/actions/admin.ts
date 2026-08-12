"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type InviteFormState = { error?: string; success?: boolean };

async function requireAdmin() {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN") throw new Error("Yetki yok");
  return user;
}

const inviteSchema = z.object({
  email: z.union([z.literal(""), z.email("Geçerli bir e-posta gir.")]),
});

const INVITE_TTL_DAYS = 7;

export async function createInvite(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const admin = await requireAdmin();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  const invitation = await prisma.invitation.create({
    data: {
      email: parsed.data.email || null,
      token: randomBytes(24).toString("base64url"),
      invitedBy: admin.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  await audit({
    userId: admin.id,
    action: "invite.create",
    entity: "invitation",
    entityId: invitation.id,
    newState: { email: invitation.email },
  });
  revalidatePath("/admin");
  return { success: true };
}

export async function revokeInvite(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("invitationId") ?? "");
  const invitation = await prisma.invitation.findUnique({ where: { id } });
  if (!invitation || invitation.usedAt) return;
  await prisma.invitation.delete({ where: { id } });
  await audit({
    userId: admin.id,
    action: "invite.revoke",
    entity: "invitation",
    entityId: id,
  });
  revalidatePath("/admin");
}
