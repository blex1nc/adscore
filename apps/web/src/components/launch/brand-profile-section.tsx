import { prisma } from "@adscore/db";
import { Trash2 } from "lucide-react";
import {
  deleteBrandAsset,
  updateBrandProfile,
  uploadBrandAsset,
  type BrandProduct,
} from "@/actions/brands";
import {
  BrandAssetUploadForm,
  BrandProfileForm,
} from "@/components/brand-form";
import { cn } from "@/components/ui";
import { ASSET_LIMIT_PER_BRAND } from "./brand-profile-limits";

const KIND_LABELS: Record<string, string> = {
  LOGO: "Logo",
  PRODUCT_IMAGE: "Ürün görseli",
  OTHER: "Diğer",
};

// Marka profili zenginleştirme + asset'ler — marka sayfası ve wizard 1. adım
// aynı bileşeni kullanır (sayfa kopyalanmaz).
export async function BrandProfileSection({ brandId }: { brandId: string }) {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      brandVoice: true,
      usp: true,
      products: true,
      assets: {
        orderBy: { createdAt: "desc" },
        select: { id: true, kind: true, name: true, mimeType: true, createdAt: true },
      },
    },
  });
  if (!brand) return null;

  const products = Array.isArray(brand.products)
    ? (brand.products as BrandProduct[])
    : null;
  // Son yüklenen logo "aktif" logodur; eskiler silinmez, kullanıcı siler
  const logo = brand.assets.find((a) => a.kind === "LOGO") ?? null;
  const others = brand.assets.filter((a) => a.id !== logo?.id);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">Marka sesi, değer önerisi, ürünler</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Arena ve Creative Studio bu alanları okur; fiyat yalnızca senin
          girdiğin değerdir.
        </p>
        <div className="mt-4">
          <BrandProfileForm
            action={updateBrandProfile.bind(null, brandId)}
            initial={{
              brandVoice: brand.brandVoice,
              usp: brand.usp,
              products,
            }}
          />
        </div>
      </div>

      <div className="border-t border-border-soft pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Logo ve görseller</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Logo önizlemelerde marka işareti olarak kullanılır. PNG/JPEG/WebP,
              en fazla 2 MB; SVG güvenlik nedeniyle kabul edilmez.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {brand.assets.length} / {ASSET_LIMIT_PER_BRAND}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div
            className={cn(
              "flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted",
              logo ? "border-accent/40" : "border-dashed border-border-soft",
            )}
            title={logo ? `Logo: ${logo.name}` : "Logo yok"}
          >
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/brand-assets/${logo.id}`}
                alt="Marka logosu"
                className="size-full object-contain"
              />
            ) : (
              <span className="px-2 text-center text-[10px] text-muted-foreground">
                Logo yok
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {logo ? (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="truncate">
                  {logo.name} · {logo.mimeType} ·{" "}
                  {logo.createdAt.toLocaleDateString("tr-TR")}
                </span>
                <form action={deleteBrandAsset}>
                  <input type="hidden" name="assetId" value={logo.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 transition-colors duration-300 hover:text-destructive"
                  >
                    <Trash2 size={12} />
                    Logoyu sil
                  </button>
                </form>
              </div>
            ) : null}
            <div className="mt-2">
              <BrandAssetUploadForm
                action={uploadBrandAsset.bind(null, brandId)}
                defaultKind={logo ? "PRODUCT_IMAGE" : "LOGO"}
              />
            </div>
          </div>
        </div>

        {others.length ? (
          <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {others.map((asset) => (
              <li
                key={asset.id}
                className="overflow-hidden rounded-xl border border-border-soft"
              >
                <div className="aspect-square bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/brand-assets/${asset.id}`}
                    alt={asset.name}
                    className="size-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[10px] text-muted-foreground">
                  <span className="truncate" title={asset.name}>
                    {KIND_LABELS[asset.kind] ?? asset.kind}
                  </span>
                  <form action={deleteBrandAsset}>
                    <input type="hidden" name="assetId" value={asset.id} />
                    <button
                      type="submit"
                      aria-label={`${asset.name} dosyasını sil`}
                      className="transition-colors duration-300 hover:text-destructive"
                    >
                      <Trash2 size={12} />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
