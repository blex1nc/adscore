// Marka profili / asset sınırları — hem server action (actions/brands.ts) hem
// formlar (components/brand-form.tsx) buradan okur. "use server" dosyası
// sabit export edemediği için ayrı modül.
export const PRODUCT_LIMIT = 20;
export const PROFILE_TEXT_LIMIT = 300;
export const ASSET_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const ASSET_LIMIT_PER_BRAND = 30;
// SVG bilinçli olarak YOK: kullanıcı SVG'si servis edilirse stored-XSS olur.
export const ASSET_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type AssetMime = (typeof ASSET_MIME_TYPES)[number];
export const ASSET_KINDS = [
  { value: "LOGO", label: "Logo" },
  { value: "PRODUCT_IMAGE", label: "Ürün görseli" },
  { value: "OTHER", label: "Diğer" },
] as const;
