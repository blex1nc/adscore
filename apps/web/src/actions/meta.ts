"use server";

// A5 — Meta bağlantı ekranı server action'ları (Ajan A; CONTRACTS §5 sahiplik).
// Kural: B ve C bu dosyaya dokunmaz. Meta'ya her çağrı lib/meta istemcisi üzerinden.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  MetaApiError,
  MetaBlockedError,
  metaClientForWorkspace,
} from "@/lib/meta/client";
import { revalidateConnection } from "@/lib/meta/token-store";

const SETTINGS_PATH = "/app/settings/meta";

export type MetaActionState = { error?: string; success?: string };

function toUserMessage(e: unknown): string {
  if (e instanceof MetaBlockedError || e instanceof MetaApiError) {
    return e.userMessage;
  }
  return "Beklenmeyen bir hata oluştu. Tekrar dene.";
}

async function requireWorkspace() {
  const user = await requireUser();
  if (!user.workspace) throw new Error("Workspace bulunamadı.");
  return { user, workspace: user.workspace };
}

// ---------------------------------------------------------------------------
// Bağlantı durumu
// ---------------------------------------------------------------------------

export async function disconnectMeta(): Promise<MetaActionState> {
  const { user, workspace } = await requireWorkspace();
  const conn = await prisma.metaConnection.findUnique({
    where: { workspaceId: workspace.id },
  });
  if (!conn) return { error: "Bağlı bir Meta hesabı yok." };
  await prisma.metaConnection.update({
    where: { id: conn.id },
    data: {
      status: "DISCONNECTED",
      // Koparılan bağlantının token'ı tutulmaz (şifreli de olsa) — boş bayt yazılır.
      tokenCipher: new Uint8Array(),
      tokenIv: new Uint8Array(),
      tokenTag: new Uint8Array(),
      tokenExpires: null,
      errorNote: null,
    },
  });
  await audit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "meta.disconnect",
    entity: "MetaConnection",
    entityId: conn.id,
    previousState: { status: conn.status },
    newState: { status: "DISCONNECTED" },
  });
  revalidatePath(SETTINGS_PATH);
  return { success: "Meta bağlantısı kesildi." };
}

export async function checkMetaConnection(): Promise<MetaActionState> {
  const { workspace } = await requireWorkspace();
  try {
    const result = await revalidateConnection(workspace.id);
    revalidatePath(SETTINGS_PATH);
    if (result.status === "CONNECTED") {
      return { success: "Bağlantı doğrulandı; token geçerli." };
    }
    return {
      error:
        result.errorNote ??
        "Bağlantı geçerli değil. Yeniden bağlanman gerekiyor.",
    };
  } catch (e) {
    return { error: toUserMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Ad account önbelleği
// ---------------------------------------------------------------------------

export async function refreshAdAccounts(): Promise<MetaActionState> {
  const { user, workspace } = await requireWorkspace();
  try {
    const client = await metaClientForWorkspace(workspace.id);
    // SOURCES-A #8: me/adaccounts — alanlar + durum kodu ham saklanır
    const rows = await client.paginate<{
      id: string;
      account_id?: string;
      name?: string;
      currency?: string;
      timezone_name?: string;
      account_status?: number;
    }>("me/adaccounts", {
      fields: "account_id,name,currency,timezone_name,account_status",
      limit: 50,
    });
    const conn = await prisma.metaConnection.findUnique({
      where: { workspaceId: workspace.id },
      select: { id: true },
    });
    if (!conn) return { error: "Bağlı bir Meta hesabı yok." };
    await prisma.$transaction([
      prisma.metaAdAccount.deleteMany({ where: { connectionId: conn.id } }),
      prisma.metaAdAccount.createMany({
        data: rows.map((r) => ({
          connectionId: conn.id,
          actId: r.id,
          name: r.name ?? r.account_id ?? r.id,
          currency: r.currency ?? "?",
          timezoneName: r.timezone_name ?? null,
          accountStatus: r.account_status ?? null,
        })),
      }),
    ]);
    await audit({
      workspaceId: workspace.id,
      userId: user.id,
      action: "meta.adaccounts.refresh",
      entity: "MetaAdAccount",
      newState: { count: rows.length },
    });
    revalidatePath(SETTINGS_PATH);
    return { success: `${rows.length} ad account listelendi.` };
  } catch (e) {
    return { error: toUserMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Varlık seçenekleri (binding formu isteğe bağlı yükler — sayfa açılışında Meta çağrısı yok)
// ---------------------------------------------------------------------------

export type MetaOption = { id: string; label: string };
export type MetaOptionsResult = { options?: MetaOption[]; error?: string };

export async function loadPageOptions(): Promise<MetaOptionsResult> {
  const { workspace } = await requireWorkspace();
  try {
    const client = await metaClientForWorkspace(workspace.id);
    // SOURCES-A #9: me/accounts — kullanıcının rolü olan Page'ler
    const rows = await client.paginate<{ id: string; name?: string }>(
      "me/accounts",
      { fields: "id,name", limit: 50 },
    );
    return {
      options: rows.map((r) => ({ id: r.id, label: r.name ?? r.id })),
    };
  } catch (e) {
    return { error: toUserMessage(e) };
  }
}

export async function loadInstagramOption(
  pageId: string,
): Promise<MetaOptionsResult> {
  const { workspace } = await requireWorkspace();
  if (!/^\d+$/.test(pageId)) return { error: "Geçersiz Page ID." };
  try {
    const client = await metaClientForWorkspace(workspace.id);
    // SOURCES-A #10: Page → instagram_business_account
    const res = await client.get<{
      instagram_business_account?: { id: string };
    }>(pageId, { fields: "instagram_business_account" });
    if (!res.instagram_business_account) {
      return {
        options: [],
        error:
          "Bu Page'e bağlı bir Instagram Business hesabı görünmüyor. (IG hesabının Page'e bağlı olması gerekir.)",
      };
    }
    return {
      options: [
        {
          id: res.instagram_business_account.id,
          label: `IG hesabı (${res.instagram_business_account.id})`,
        },
      ],
    };
  } catch (e) {
    return { error: toUserMessage(e) };
  }
}

export async function loadPixelOptions(
  adAccountId: string,
): Promise<MetaOptionsResult> {
  const { workspace } = await requireWorkspace();
  if (!/^act_\d+$/.test(adAccountId)) return { error: "Geçersiz ad account." };
  try {
    const client = await metaClientForWorkspace(workspace.id);
    // SOURCES-A #11: act_X/adspixels
    const rows = await client.paginate<{ id: string; name?: string }>(
      `${adAccountId}/adspixels`,
      { fields: "id,name", limit: 50 },
    );
    return {
      options: rows.map((r) => ({ id: r.id, label: r.name ?? r.id })),
    };
  } catch (e) {
    return { error: toUserMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Marka ↔ Meta varlık bağlama
// ---------------------------------------------------------------------------

const bindSchema = z.object({
  brandId: z.string().min(1),
  adAccountId: z.string().regex(/^act_\d+$/, "Bir ad account seç."),
  pageId: z.string().regex(/^\d+$/, "Facebook Page zorunlu — yayın hattı Page olmadan çalışmaz."),
  instagramActorId: z.string().regex(/^\d*$/).optional(),
  pixelId: z.string().regex(/^\d*$/).optional(),
});

export async function bindBrandMeta(
  _prev: MetaActionState,
  formData: FormData,
): Promise<MetaActionState> {
  const { user, workspace } = await requireWorkspace();
  const parsed = bindSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }
  const input = parsed.data;

  // Marka bu workspace'e mi ait? (tenant izolasyonu)
  const brand = await prisma.brand.findFirst({
    where: { id: input.brandId, workspaceId: workspace.id },
    select: { id: true, name: true },
  });
  if (!brand) return { error: "Marka bulunamadı." };

  const conn = await prisma.metaConnection.findUnique({
    where: { workspaceId: workspace.id },
    include: {
      adAccounts: { where: { actId: input.adAccountId }, take: 1 },
    },
  });
  if (!conn || conn.status !== "CONNECTED") {
    return {
      error:
        "Meta bağlantısı aktif değil. Önce bağlan, sonra markayı varlıklara bağla.",
    };
  }
  const cached = conn.adAccounts[0];
  if (!cached) {
    return {
      error:
        "Seçilen ad account önbellekte yok. Önce 'Ad account listesini yenile' ile listeyi güncelle.",
    };
  }

  const data = {
    connectionId: conn.id,
    adAccountId: input.adAccountId,
    adAccountCurrency: cached.currency,
    pageId: input.pageId,
    instagramActorId: input.instagramActorId || null,
    pixelId: input.pixelId || null,
  };
  const previous = await prisma.brandMetaBinding.findUnique({
    where: { brandId: brand.id },
  });
  await prisma.brandMetaBinding.upsert({
    where: { brandId: brand.id },
    create: { brandId: brand.id, ...data },
    update: data,
  });
  await audit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "meta.bind",
    entity: "BrandMetaBinding",
    entityId: brand.id,
    previousState: previous
      ? {
          adAccountId: previous.adAccountId,
          pageId: previous.pageId,
          instagramActorId: previous.instagramActorId,
          pixelId: previous.pixelId,
        }
      : undefined,
    newState: {
      adAccountId: data.adAccountId,
      pageId: data.pageId,
      instagramActorId: data.instagramActorId,
      pixelId: data.pixelId,
    },
  });
  revalidatePath(SETTINGS_PATH);
  return { success: `"${brand.name}" Meta varlıklarına bağlandı.` };
}

export async function unbindBrandMeta(brandId: string): Promise<MetaActionState> {
  const { user, workspace } = await requireWorkspace();
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspaceId: workspace.id },
    select: { id: true, name: true, metaBinding: true },
  });
  if (!brand?.metaBinding) return { error: "Bu markanın Meta bağı yok." };
  await prisma.brandMetaBinding.delete({ where: { brandId: brand.id } });
  await audit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "meta.unbind",
    entity: "BrandMetaBinding",
    entityId: brand.id,
    previousState: {
      adAccountId: brand.metaBinding.adAccountId,
      pageId: brand.metaBinding.pageId,
    },
  });
  revalidatePath(SETTINGS_PATH);
  return { success: `"${brand.name}" Meta bağı kaldırıldı.` };
}

// ---------------------------------------------------------------------------
// Harcama tavanı (CLAUDE.md §23 — limiti kullanıcı belirler, guard'lar zorlar)
// ---------------------------------------------------------------------------

const budgetSchema = z.object({
  maxDailyBudget: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,2})?$/, "Tutar sayısal olmalı (ör. 500 veya 500,50).")
    .or(z.literal("")),
});

export async function setMaxDailyBudget(
  _prev: MetaActionState,
  formData: FormData,
): Promise<MetaActionState> {
  const { user, workspace } = await requireWorkspace();
  const parsed = budgetSchema.safeParse({
    maxDailyBudget: formData.get("maxDailyBudget") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Tutar geçersiz." };
  }
  const raw = parsed.data.maxDailyBudget;
  const normalized = raw === "" ? null : raw.replace(",", ".");
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { maxDailyBudget: normalized },
  });
  await audit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "meta.budget_cap.set",
    entity: "Workspace",
    entityId: workspace.id,
    previousState: {
      maxDailyBudget: workspace.maxDailyBudget?.toString() ?? null,
    },
    newState: { maxDailyBudget: normalized },
  });
  revalidatePath(SETTINGS_PATH);
  return {
    success:
      normalized === null
        ? "Günlük bütçe tavanı kaldırıldı. Dikkat: tavan olmadan Meta yayını açılamaz (güvenlik kilidi)."
        : `Günlük bütçe tavanı ${normalized} olarak kaydedildi.`,
  };
}
