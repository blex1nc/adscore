import "server-only";

// Sprint migration'ına (20260823_arena_kit_brand_assets, Ajan A) bağımlı
// okumalar TEK bu dosyada toplanır. Migration cherry-pick edilmeden önce
// stub döner; sonra gerçek sorgularla değiştirilir (AGENT-C §3 notu).
//
// DURUM: PRE-MIGRATION STUB — EvolutionRun / Brand.usp / CampaignPlan.publishedAt
// henüz Prisma client'ta yok.

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
  // Son planın "Ads Manager'da yayınladım" işareti (Ajan B'nin kit sayfası yazar)
  publishedAt: Date | null;
};

export async function readBridgeFields(
  _brandId: string,
  _latestPlanId: string | null,
): Promise<BridgeFields> {
  void _brandId;
  void _latestPlanId;
  return {
    usp: null,
    brandVoice: null,
    productCount: 0,
    logoAssetId: null,
    arena: {
      latestStatus: null,
      latestRunId: null,
      currentRound: null,
      maxRounds: null,
    },
    publishedAt: null,
  };
}

// Birden çok marka için (dashboard) — aynı stub
export async function readBridgeFieldsMany(
  brands: Array<{ id: string; latestPlanId: string | null }>,
): Promise<Map<string, BridgeFields>> {
  const map = new Map<string, BridgeFields>();
  for (const b of brands) {
    map.set(b.id, await readBridgeFields(b.id, b.latestPlanId));
  }
  return map;
}
