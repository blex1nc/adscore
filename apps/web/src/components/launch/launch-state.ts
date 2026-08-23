import "server-only";
import { prisma, type Prisma } from "@adscore/db";
import { MIN_ADS_FOR_PATTERNS } from "@/lib/competitors/run";
import {
  readBridgeFields,
  readBridgeFieldsMany,
  type BridgeFields,
} from "./launch-bridge";

// Launch Wizard durum makinesi — AGENT-C §3.
// Durum DB'den TÜRETİLİR; ayrı wizard state'i tutulmaz. "Atlandı" bile
// kalıcı değildir: sonraki adımlarda ilerleme varsa atlanmış sayılır.

export type StepKey =
  | "profile"
  | "research"
  | "competitors"
  | "arena"
  | "approval"
  | "plan"
  | "kit"
  | "results";

export type StepStatus = "done" | "active" | "available" | "locked" | "skipped";

export type LaunchStep = {
  index: number; // 1..8
  key: StepKey;
  title: string;
  optional: boolean;
  status: StepStatus;
  running: boolean;
  // Kilit nedeni / uyarı (kapı bypass edilmez, nedeni yazılır)
  note?: string;
  detailHref: string;
};

export type LaunchSummary = {
  brandId: string;
  brandName: string;
  profileReady: boolean;
  website: string | null;
  research: {
    latestStatus: string | null;
    latestError: string | null;
    hasCompleted: boolean;
  };
  competitors: {
    count: number;
    analyzedAds: number;
    patternStatus: string | null;
    adsRunning: boolean;
  };
  arena: BridgeFields["arena"];
  creatives: {
    total: number;
    approved: number;
    pending: number;
    generationRunning: boolean;
    imageRunning: boolean;
  };
  plan: {
    latestId: string | null;
    latestStatus: string | null;
    latestError: string | null;
    publishedAt: Date | null;
    resultCount: number;
    analysisRunning: boolean;
  };
  bridge: BridgeFields;
};

export type LaunchState = {
  summary: LaunchSummary;
  steps: LaunchStep[];
  // İlk tamamlanmamış ZORUNLU adım
  activeIndex: number;
  // Wizard'ın varsayılan açtığı adım (opsiyonel rakip adımı önerilebilir)
  suggestedIndex: number;
  running: boolean;
  allDone: boolean;
  nextAction: string;
};

export { MIN_ADS_FOR_PATTERNS };

const launchInclude = {
  researchRuns: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { status: true, error: true },
  },
  competitors: { select: { ads: { select: { status: true } } } },
  patternAnalyses: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { status: true },
  },
  creativeGenerations: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { status: true },
  },
  creatives: {
    select: {
      approval: true,
      images: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  },
  campaignPlans: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      status: true,
      error: true,
      results: { select: { analysisStatus: true } },
    },
  },
  _count: {
    select: { researchRuns: { where: { status: "COMPLETED" } } },
  },
} satisfies Prisma.BrandInclude;

type BrandWithLaunch = Prisma.BrandGetPayload<{ include: typeof launchInclude }>;

const isActive = (s: string | null | undefined) =>
  s === "QUEUED" || s === "RUNNING";

function toSummary(brand: BrandWithLaunch, bridge: BridgeFields): LaunchSummary {
  const latestResearch = brand.researchRuns[0] ?? null;
  const ads = brand.competitors.flatMap((c) => c.ads);
  const latestPlan = brand.campaignPlans[0] ?? null;
  const latestGeneration = brand.creativeGenerations[0] ?? null;
  return {
    brandId: brand.id,
    brandName: brand.name,
    website: brand.website,
    // Adım 1 koşulu: website + (açıklama veya USP)
    profileReady: Boolean(
      brand.website && (brand.description?.trim() || bridge.usp?.trim()),
    ),
    research: {
      latestStatus: latestResearch?.status ?? null,
      latestError: latestResearch?.error ?? null,
      hasCompleted: brand._count.researchRuns > 0,
    },
    competitors: {
      count: brand.competitors.length,
      analyzedAds: ads.filter((a) => a.status === "COMPLETED").length,
      patternStatus: brand.patternAnalyses[0]?.status ?? null,
      adsRunning: ads.some((a) => isActive(a.status)),
    },
    arena: bridge.arena,
    creatives: {
      total: brand.creatives.length,
      approved: brand.creatives.filter((c) => c.approval === "APPROVED").length,
      pending: brand.creatives.filter((c) => c.approval === "PENDING").length,
      generationRunning: isActive(latestGeneration?.status),
      imageRunning: brand.creatives.some((c) =>
        isActive(c.images[0]?.status),
      ),
    },
    plan: {
      latestId: latestPlan?.id ?? null,
      latestStatus: latestPlan?.status ?? null,
      latestError: latestPlan?.error ?? null,
      publishedAt: bridge.publishedAt,
      resultCount: latestPlan?.results.length ?? 0,
      analysisRunning:
        latestPlan?.results.some((r) => isActive(r.analysisStatus)) ?? false,
    },
    bridge,
  };
}

export function computeLaunchState(s: LaunchSummary): LaunchState {
  const base = `/app/brands/${s.brandId}`;
  const researchRunning = isActive(s.research.latestStatus);
  const patternDone = s.competitors.patternStatus === "COMPLETED";
  const arenaStarted = s.arena.latestStatus != null;
  const arenaDone = s.arena.latestStatus === "COMPLETED";

  // Her adımın "hazır sayılma" koşulu (AGENT-C §3 tablosu)
  const satisfied: Record<StepKey, boolean> = {
    profile: s.profileReady,
    research: s.research.hasCompleted,
    competitors: patternDone,
    // Arena önerilen yol; Creative Studio ile üretilmiş creative de kaynak sayılır
    // (A merge'üne kadar ve Arena'sız kullanım için). Kapı değil, yönlendirme.
    arena: arenaDone || s.creatives.total > 0,
    approval: s.creatives.approved >= 1,
    plan: s.plan.latestStatus === "COMPLETED",
    kit: s.plan.publishedAt != null,
    results: s.plan.resultCount >= 1,
  };

  const order: StepKey[] = [
    "profile",
    "research",
    "competitors",
    "arena",
    "approval",
    "plan",
    "kit",
    "results",
  ];
  const required = order.filter((k) => k !== "competitors");
  const firstOpen = required.find((k) => !satisfied[k]);
  const activeIndex = firstOpen ? order.indexOf(firstOpen) + 1 : 8;
  const allDone = !firstOpen;

  const competitorsSkipped =
    satisfied.research &&
    !patternDone &&
    (arenaStarted || s.creatives.total > 0 || activeIndex > 4);

  const running: Record<StepKey, boolean> = {
    profile: false,
    research: researchRunning,
    competitors:
      s.competitors.adsRunning || isActive(s.competitors.patternStatus),
    arena: isActive(s.arena.latestStatus),
    approval: s.creatives.generationRunning || s.creatives.imageRunning,
    plan: isActive(s.plan.latestStatus),
    kit: false,
    results: s.plan.analysisRunning,
  };

  const titles: Record<StepKey, string> = {
    profile: "Marka profili",
    research: "Araştırma",
    competitors: "Rakipler",
    arena: "Arena",
    approval: "Onay",
    plan: "Plan",
    kit: "Kit & yayın",
    results: "Sonuç",
  };

  const hrefs: Record<StepKey, string> = {
    profile: base,
    research: base,
    competitors: `${base}/competitors`,
    arena: `${base}/arena`,
    approval: `${base}/creatives`,
    plan: `${base}/campaigns`,
    kit: s.plan.latestId
      ? `${base}/campaigns/${s.plan.latestId}/kit`
      : `${base}/campaigns`,
    results: `${base}/campaigns`,
  };

  // Kilit nedenleri — mevcut kapılarla birebir
  const lockNotes: Partial<Record<StepKey, string>> = {
    research: !s.website ? "Araştırma için önce website gerekli." : undefined,
    competitors: !satisfied.research
      ? "Rakip adayları tamamlanmış araştırmadan gelir."
      : undefined,
    arena: !satisfied.research
      ? "Arena ve copy üretimi tamamlanmış araştırma gerektirir; veri olmadan üretim yapılmaz."
      : undefined,
    approval:
      s.creatives.total === 0
        ? "Onaylanacak creative yok; önce Arena'da yarıştır veya üret."
        : undefined,
    plan:
      s.creatives.approved === 0
        ? "Plan yalnızca onaylı creative ile hazırlanır (CLAUDE.md §16)."
        : undefined,
    kit:
      s.plan.latestStatus !== "COMPLETED"
        ? "Kit için tamamlanmış bir plan gerekir."
        : undefined,
    results:
      s.plan.publishedAt == null
        ? "Sonuç, kampanya Ads Manager'da yayınlandıktan sonra girilir."
        : undefined,
  };

  const steps: LaunchStep[] = order.map((key, i) => {
    const index = i + 1;
    const optional = key === "competitors";
    let status: StepStatus;
    if (satisfied[key]) status = "done";
    else if (optional) {
      status = !satisfied.research
        ? "locked"
        : competitorsSkipped
          ? "skipped"
          : "available";
    } else if (index === activeIndex) status = "active";
    else status = "locked";

    let note: string | undefined;
    if (status === "locked") note = lockNotes[key] ?? "Önceki adımlar tamamlanmalı.";
    if (status === "skipped")
      note = "Pattern verisi olmadan üretim; güven düşer.";
    if (key === "research" && satisfied.research && s.research.latestStatus === "FAILED")
      note = "Son araştırma başarısız; önceki tamamlanmış sonuç kullanılıyor.";
    if (key === "arena" && satisfied.arena && !arenaDone)
      note = "Arena koşusu yok; creative'ler Creative Studio'dan geldi.";

    return {
      index,
      key,
      title: titles[key],
      optional,
      status,
      running: running[key],
      note,
      detailHref: hrefs[key],
    };
  });

  // Araştırma bitti, henüz rakip/arena/creative yoksa opsiyonel adımı öner
  const suggestedIndex =
    activeIndex === 4 &&
    s.competitors.count === 0 &&
    !patternDone &&
    !arenaStarted &&
    s.creatives.total === 0
      ? 3
      : activeIndex;

  const nextAction = (() => {
    switch (firstOpen) {
      case "profile":
        return "Website ve açıklama/USP ekle";
      case "research":
        return researchRunning ? "Araştırma sürüyor" : "Araştırmayı başlat";
      case "arena":
        return isActive(s.arena.latestStatus)
          ? "Arena koşusu sürüyor"
          : "Arena'da reklam yarıştır";
      case "approval":
        return s.creatives.generationRunning
          ? "Creative üretimi sürüyor"
          : s.creatives.pending > 0
            ? `${s.creatives.pending} creative onay bekliyor`
            : "Creative üret ve onayla";
      case "plan":
        return isActive(s.plan.latestStatus)
          ? "Plan hazırlanıyor"
          : "Bütçeyi gir, planı hazırla";
      case "kit":
        return "Kit ile Ads Manager'da kur, yayınladım işaretle";
      case "results":
        return "Ads Manager sonucunu gir";
      default:
        return "Sonuç girildi — analiz ve optimizasyon";
    }
  })();

  return {
    summary: s,
    steps,
    activeIndex,
    suggestedIndex,
    running: Object.values(running).some(Boolean),
    allDone,
    nextAction,
  };
}

// Wizard sayfası için (tenant kontrolü çağıranın workspaceId'siyle)
export async function loadLaunchState(brandId: string, workspaceId: string) {
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspaceId },
    include: launchInclude,
  });
  if (!brand) return null;
  const bridge = await readBridgeFields(
    brand.id,
    brand.campaignPlans[0]?.id ?? null,
  );
  return computeLaunchState(toSummary(brand, bridge));
}

// Dashboard için: workspace'teki tüm markalar, tek sorgu + bridge
export async function loadLaunchStates(workspaceId: string) {
  const brands = await prisma.brand.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: launchInclude,
  });
  const bridges = await readBridgeFieldsMany(
    brands.map((b) => ({
      id: b.id,
      latestPlanId: b.campaignPlans[0]?.id ?? null,
    })),
  );
  return brands.map((b) =>
    computeLaunchState(
      toSummary(b, bridges.get(b.id) ?? {
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
      }),
    ),
  );
}
