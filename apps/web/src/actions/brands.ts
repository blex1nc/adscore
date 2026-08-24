"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, Prisma } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  COPY_LANGUAGE_CODES,
  CURRENCY_CODES,
  MARKET_CODES,
} from "@/lib/options";
import {
  ASSET_LIMIT_PER_BRAND,
  ASSET_MAX_BYTES,
  ASSET_MIME_TYPES,
  PRODUCT_LIMIT,
  PROFILE_TEXT_LIMIT,
  type AssetMime,
} from "@/components/launch/brand-profile-limits";

export type BrandFormState = { error?: string; success?: boolean };

const brandSchema = z.object({
  name: z.string().min(2, "Marka adı en az 2 karakter olmalı.").max(120),
  website: z
    .union([z.literal(""), z.url("Geçerli bir URL gir (https:// ile).")])
    .optional(),
  description: z.string().max(2000).optional(),
  targetMarket: z
    .union([z.literal(""), z.enum(MARKET_CODES as [string, ...string[]])])
    .optional(),
  currency: z
    .union([z.literal(""), z.enum(CURRENCY_CODES as [string, ...string[]])])
    .optional(),
  copyLanguage: z
    .union([
      z.literal(""),
      z.enum(COPY_LANGUAGE_CODES as [string, ...string[]]),
    ])
    .optional(),
});

function toData(values: z.infer<typeof brandSchema>) {
  return {
    name: values.name,
    website: values.website || null,
    description: values.description || null,
    targetMarket: values.targetMarket || null,
    currency: values.currency || null,
    copyLanguage: values.copyLanguage || null,
  };
}

export async function createBrand(
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const user = await requireUser();
  if (!user.workspace) return { error: "Workspace bulunamadı." };
  const parsed = brandSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  const brand = await prisma.brand.create({
    data: { ...toData(parsed.data), workspaceId: user.workspace.id },
  });
  await audit({
    workspaceId: user.workspace.id,
    userId: user.id,
    action: "brand.create",
    entity: "brand",
    entityId: brand.id,
    newState: toData(parsed.data),
  });
  revalidatePath("/app/brands");
  redirect(`/app/brands/${brand.id}`);
}

export async function updateBrand(
  brandId: string,
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const user = await requireUser();
  // Tenant izolasyonu: marka bu kullanıcının workspace'inde olmalı
  const existing = await prisma.brand.findFirst({
    where: { id: brandId, workspace: { ownerId: user.id } },
  });
  if (!existing) return { error: "Marka bulunamadı." };
  const parsed = brandSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  await prisma.brand.update({
    where: { id: existing.id },
    data: toData(parsed.data),
  });
  await audit({
    workspaceId: existing.workspaceId,
    userId: user.id,
    action: "brand.update",
    entity: "brand",
    entityId: existing.id,
    previousState: {
      name: existing.name,
      website: existing.website,
      description: existing.description,
      targetMarket: existing.targetMarket,
      currency: existing.currency,
      copyLanguage: existing.copyLanguage,
    },
    newState: toData(parsed.data),
  });
  revalidatePath("/app/brands");
  revalidatePath(`/app/brands/${existing.id}`);
  return { success: true };
}

export async function deleteBrand(formData: FormData) {
  const user = await requireUser();
  const brandId = String(formData.get("brandId") ?? "");
  const existing = await prisma.brand.findFirst({
    where: { id: brandId, workspace: { ownerId: user.id } },
  });
  if (!existing) return;
  await prisma.brand.delete({ where: { id: existing.id } });
  await audit({
    workspaceId: existing.workspaceId,
    userId: user.id,
    action: "brand.delete",
    entity: "brand",
    entityId: existing.id,
    previousState: { name: existing.name },
  });
  revalidatePath("/app/brands");
  redirect("/app/brands");
}

// ---------------------------------------------------------------------------
// Marka profili zenginleştirme (AGENT-C §2): ses / USP / ürünler / asset'ler.
// Fiyatı KULLANICI girer; sistem üretmez. Asset'ler DB'de bytea (CreativeImage
// ile aynı karar), auth + tenant korumalı /api/brand-assets/[id] ile servis edilir.
// ---------------------------------------------------------------------------


const productSchema = z.object({
  name: z.string().trim().min(1, "Ürün adı gerekli.").max(120),
  price: z.string().trim().max(40).optional(),
  url: z
    .union([z.literal(""), z.url("Ürün URL'i geçersiz (https:// ile).")])
    .optional(),
  description: z.string().trim().max(300).optional(),
});

const profileSchema = z.object({
  brandVoice: z
    .string()
    .trim()
    .max(PROFILE_TEXT_LIMIT, `Marka sesi en fazla ${PROFILE_TEXT_LIMIT} karakter.`),
  usp: z
    .string()
    .trim()
    .max(
      PROFILE_TEXT_LIMIT,
      `Ayrıştırıcı değer en fazla ${PROFILE_TEXT_LIMIT} karakter.`,
    ),
  products: z
    .array(productSchema)
    .max(PRODUCT_LIMIT, `En fazla ${PRODUCT_LIMIT} ürün girilebilir.`),
});

export type BrandProduct = z.infer<typeof productSchema>;

function parseProducts(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function requireOwnedBrand(brandId: string) {
  const user = await requireUser();
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspace: { ownerId: user.id } },
  });
  if (!brand) return null;
  return { user, brand };
}

function revalidateBrand(brandId: string) {
  revalidatePath(`/app/brands/${brandId}`);
  revalidatePath(`/app/brands/${brandId}/launch`);
  revalidatePath("/app");
}

export async function updateBrandProfile(
  brandId: string,
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const owned = await requireOwnedBrand(brandId);
  if (!owned) return { error: "Marka bulunamadı." };

  const products = parseProducts(formData.get("products"));
  if (products === null) return { error: "Ürün listesi okunamadı." };
  const parsed = profileSchema.safeParse({
    brandVoice: formData.get("brandVoice") ?? "",
    usp: formData.get("usp") ?? "",
    products,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }

  // Boş alanlar null; ürün satırlarında boş opsiyonel alanlar atılır
  const cleanProducts = parsed.data.products.map((p) => ({
    name: p.name,
    ...(p.price ? { price: p.price } : {}),
    ...(p.url ? { url: p.url } : {}),
    ...(p.description ? { description: p.description } : {}),
  }));
  const data = {
    brandVoice: parsed.data.brandVoice || null,
    usp: parsed.data.usp || null,
    products: cleanProducts.length ? cleanProducts : Prisma.DbNull,
  };
  await prisma.brand.update({ where: { id: owned.brand.id }, data });
  await audit({
    workspaceId: owned.brand.workspaceId,
    userId: owned.user.id,
    action: "brand.profile_update",
    entity: "brand",
    entityId: owned.brand.id,
    previousState: {
      brandVoice: owned.brand.brandVoice,
      usp: owned.brand.usp,
      productCount: Array.isArray(owned.brand.products)
        ? owned.brand.products.length
        : 0,
    },
    newState: {
      brandVoice: data.brandVoice,
      usp: data.usp,
      productCount: cleanProducts.length,
    },
  });
  revalidateBrand(owned.brand.id);
  return { success: true };
}

export type BrandAssetFormState = { error?: string; success?: boolean };

// Dosya içeriği, beyan edilen MIME'a güvenilmeden imza baytlarıyla doğrulanır
function sniffImageMime(bytes: Uint8Array): AssetMime | null {
  if (bytes.length < 12) return null;
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

function sanitizeAssetName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "";
  // Kontrol karakterleri atılır, uzunluk sınırlanır
  const cleaned = Array.from(base)
    .filter((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) !== 0x7f)
    .join("")
    .trim()
    .slice(0, 120);
  return cleaned || "asset";
}

export async function uploadBrandAsset(
  brandId: string,
  _prev: BrandAssetFormState,
  formData: FormData,
): Promise<BrandAssetFormState> {
  const owned = await requireOwnedBrand(brandId);
  if (!owned) return { error: "Marka bulunamadı." };

  const kindRaw = String(formData.get("kind") ?? "");
  const kind = (["LOGO", "PRODUCT_IMAGE", "OTHER"] as const).find(
    (k) => k === kindRaw,
  );
  if (!kind) return { error: "Asset türü geçersiz." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bir görsel dosyası seç." };
  }
  if (file.size > ASSET_MAX_BYTES) {
    return {
      error: `Dosya ${(file.size / 1024 / 1024).toFixed(1)} MB; sınır 2 MB.`,
    };
  }
  if (!ASSET_MIME_TYPES.includes(file.type as AssetMime)) {
    return {
      error: `Yalnız PNG, JPEG veya WebP kabul edilir (gelen: ${file.type || "bilinmiyor"}). SVG güvenlik nedeniyle reddedilir.`,
    };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageMime(bytes);
  if (!sniffed || sniffed !== file.type) {
    return {
      error:
        "Dosya içeriği beyan edilen görsel türüyle uyuşmuyor; dosya reddedildi.",
    };
  }

  const count = await prisma.brandAsset.count({ where: { brandId } });
  if (count >= ASSET_LIMIT_PER_BRAND) {
    return {
      error: `Marka başına en fazla ${ASSET_LIMIT_PER_BRAND} asset saklanır; önce birini sil.`,
    };
  }

  const asset = await prisma.brandAsset.create({
    data: {
      brandId,
      kind,
      name: sanitizeAssetName(file.name),
      mimeType: sniffed,
      data: bytes,
    },
    select: { id: true, name: true },
  });
  await audit({
    workspaceId: owned.brand.workspaceId,
    userId: owned.user.id,
    action: "brand_asset.upload",
    entity: "brand_asset",
    entityId: asset.id,
    newState: { kind, name: asset.name, mimeType: sniffed, bytes: file.size },
  });
  revalidateBrand(brandId);
  return { success: true };
}

export async function deleteBrandAsset(formData: FormData) {
  const user = await requireUser();
  const assetId = String(formData.get("assetId") ?? "");
  const asset = await prisma.brandAsset.findFirst({
    where: { id: assetId, brand: { workspace: { ownerId: user.id } } },
    select: {
      id: true,
      kind: true,
      name: true,
      brandId: true,
      brand: { select: { workspaceId: true } },
    },
  });
  if (!asset) return;
  await prisma.brandAsset.delete({ where: { id: asset.id } });
  await audit({
    workspaceId: asset.brand.workspaceId,
    userId: user.id,
    action: "brand_asset.delete",
    entity: "brand_asset",
    entityId: asset.id,
    previousState: { kind: asset.kind, name: asset.name },
  });
  revalidateBrand(asset.brandId);
}
