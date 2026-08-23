import "server-only";
import { prisma } from "@adscore/db";

// Sprint migration'ına (20260823150335_arena_kit_brand_assets, Ajan A) bağımlı
// okumalar TEK bu dosyada toplanır: Brand.usp/brandVoice/products, BrandAsset,
// EvolutionRun (yalnız DB okuması — A'nın action/lib'i import EDİLMEZ) ve
// CampaignPlan.publishedAt (B'nin kit sayfası yazar, burada yalnız okunur).

export type ArenaSummary = {
  latestStatus: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | null;
  latestRunId: string | null;
  currentRound: number | null;
  maxRounds: number | null;
};

export type BridgeFields = {
  usp: string | null;
  brandVoice: string | null;
  productCount: number;
  logoAssetId: string | null;
  arena: ArenaSummary;
  // Son planın "Ads Manager'da yayınladım" işareti
  publishedAt: Date | null;
};

const EMPTY_ARENA: ArenaSummary = {
  latestStatus: null,
  latestRunId: null,
  currentRound: null,
  maxRounds: null,
};

export const EMPTY_BRIDGE: BridgeFields = {
  usp: null,
  brandVoice: null,
  productCount: 0,
  logoAssetId: null,
  arena: EMPTY_ARENA,
  publishedAt: null,
};

function productCountOf(products: unknown) {
  return Array.isArray(products) ? products.length : 0;
}

export async function readBridgeFields(
  brandId: string,
  latestPlanId: string | null,
): Promise<BridgeFields> {
  const [brand, latestRun, logo, plan] = await Promise.all([
    prisma.brand.findUnique({
      where: { id: brandId },
      select: { usp: true, brandVoice: true, products: true },
    }),
    prisma.evolutionRun.findFirst({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, currentRound: true, maxRounds: true },
    }),
    prisma.brandAsset.findFirst({
      where: { brandId, kind: "LOGO" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    latestPlanId
      ? prisma.campaignPlan.findUnique({
          where: { id: latestPlanId },
          select: { publishedAt: true },
        })
      : Promise.resolve(null),
  ]);
  return {
    usp: brand?.usp ?? null,
    brandVoice: brand?.brandVoice ?? null,
    productCount: productCountOf(brand?.products),
    logoAssetId: logo?.id ?? null,
    arena: latestRun
      ? {
          latestStatus: latestRun.status,
          latestRunId: latestRun.id,
          currentRound: latestRun.currentRound,
          maxRounds: latestRun.maxRounds,
        }
      : EMPTY_ARENA,
    publishedAt: plan?.publishedAt ?? null,
  };
}

// Dashboard: tüm markalar için toplu okuma (N+1 yerine 4 sorgu)
export async function readBridgeFieldsMany(
  brands: Array<{ id: string; latestPlanId: string | null }>,
): Promise<Map<string, BridgeFields>> {
  const map = new Map<string, BridgeFields>();
  if (brands.length === 0) return map;
  const brandIds = brands.map((b) => b.id);
  const planIds = brands.flatMap((b) => (b.latestPlanId ? [b.latestPlanId] : []));

  const [brandRows, runs, logos, plans] = await Promise.all([
    prisma.brand.findMany({
      where: { id: { in: brandIds } },
      select: { id: true, usp: true, brandVoice: true, products: true },
    }),
    prisma.evolutionRun.findMany({
      where: { brandId: { in: brandIds } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        brandId: true,
        status: true,
        currentRound: true,
        maxRounds: true,
      },
    }),
    prisma.brandAsset.findMany({
      where: { brandId: { in: brandIds }, kind: "LOGO" },
      orderBy: { createdAt: "desc" },
      select: { id: true, brandId: true },
    }),
    planIds.length
      ? prisma.campaignPlan.findMany({
          where: { id: { in: planIds } },
          select: { id: true, publishedAt: true },
        })
      : Promise.resolve([]),
  ]);

  for (const b of brands) {
    const row = brandRows.find((r) => r.id === b.id);
    const run = runs.find((r) => r.brandId === b.id); // desc sıralı → ilk = son koşu
    const logo = logos.find((l) => l.brandId === b.id);
    const plan = plans.find((p) => p.id === b.latestPlanId);
    map.set(b.id, {
      usp: row?.usp ?? null,
      brandVoice: row?.brandVoice ?? null,
      productCount: productCountOf(row?.products),
      logoAssetId: logo?.id ?? null,
      arena: run
        ? {
            latestStatus: run.status,
            latestRunId: run.id,
            currentRound: run.currentRound,
            maxRounds: run.maxRounds,
          }
        : EMPTY_ARENA,
      publishedAt: plan?.publishedAt ?? null,
    });
  }
  return map;
}
