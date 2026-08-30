import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { deleteCompetitor } from "@/actions/competitors";
import { MIN_ADS_FOR_PATTERNS } from "@/lib/competitors/run";
import { COMPETITOR_TYPE_LABELS } from "@/lib/options";
import { cn } from "@/components/ui";
import {
  AdAnalysisView,
  ConfidenceBadge,
  type AdAnalysis,
} from "@/components/competitors/ad-analysis-view";
import {
  AddAdForm,
  AddCompetitorForm,
  PatternStartForm,
} from "@/components/competitors/competitor-forms";
import { ResearchPoller } from "@/components/research/research-poller";
import { AdLibrarySearch } from "@/components/library/ad-library-search";
import { AdLibraryBadge } from "@/components/library/ad-library-badge";

export const metadata = { title: "Rakipler | AdScore" };
export const maxDuration = 60;

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "Sırada",
  RUNNING: "Analiz ediliyor",
  COMPLETED: "Analiz edildi",
  FAILED: "Başarısız",
};

type PatternResult = {
  observed_patterns?: Array<{ pattern?: string; evidence?: string }>;
  hypotheses?: Array<{ hypothesis?: string; confidence?: string }>;
  adaptation_notes?: string[];
  data_gaps?: string[];
};

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user?.workspace) redirect("/login");

  const brand = await prisma.brand.findFirst({
    where: { id, workspaceId: user.workspace.id },
    include: {
      competitors: {
        orderBy: { createdAt: "asc" },
        include: { ads: { orderBy: { createdAt: "desc" } } },
      },
      patternAnalyses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!brand) notFound();

  const analyzedAdCount = brand.competitors
    .flatMap((c) => c.ads)
    .filter((ad) => ad.status === "COMPLETED").length;
  const latestPattern = brand.patternAnalyses[0];
  const hasActiveWork =
    brand.competitors.some((c) =>
      c.ads.some((ad) => ad.status === "QUEUED" || ad.status === "RUNNING"),
    ) ||
    latestPattern?.status === "QUEUED" ||
    latestPattern?.status === "RUNNING";

  return (
    <div className="mx-auto w-full max-w-5xl">
      {hasActiveWork ? <ResearchPoller /> : null}
      <Link
        href={`/app/brands/${brand.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft size={14} />
        {brand.name}
      </Link>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">Rakipler</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Rakip reklamları kopyalanmaz; yapılandırılmış analizle pattern
        çıkarılır ve markana uyarlanır. Reklamlar referans + analiz olarak
        saklanır.
      </p>

      <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6">
        <h2 className="text-sm font-medium">Rakip ekle</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Marka araştırmasındaki adayları tek tıkla ekleyebilir, elle
          girebilir ya da{" "}
          <Link href={`/app/brands/${brand.id}/ad-library`} className="text-accent hover:opacity-80">
            Ad Library&apos;de gezip
          </Link>{" "}
          bulduğun reklamı sayfasıyla birlikte içe aktarabilirsin. Ad Library
          yalnız kapsamdaki (EU&apos;ya ulaşan) reklamları döndürür; kapsam
          dışındaki reklamlar için metni elle ekle.
        </p>
        <div className="mt-4">
          <AddCompetitorForm brandId={brand.id} />
        </div>
      </div>

      {brand.competitors.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Henüz rakip yok.</p>
          <Link
            href={`/app/brands/${brand.id}/ad-library`}
            className="mt-3 inline-block text-xs text-accent hover:opacity-80"
          >
            Ad Library&apos;de ara ve bulduğun sayfadan rakip oluştur →
          </Link>
        </div>
      ) : (
        brand.competitors.map((competitor) => (
          <div
            key={competitor.id}
            className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{competitor.name}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {COMPETITOR_TYPE_LABELS[competitor.type]}
                  </span>
                  {competitor.addedFrom === "ad_library" ? (
                    <span
                      className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                      title="Meta Ad Library'de bulunan sayfadan oluşturuldu"
                    >
                      ad library
                    </span>
                  ) : null}
                  {competitor.addedFrom === "research" ? (
                    <span
                      className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                      title="Marka araştırması adayından eklendi"
                    >
                      araştırmadan
                    </span>
                  ) : null}
                </div>
                {competitor.website ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {competitor.website}
                  </p>
                ) : null}
                {competitor.note ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {competitor.note}
                  </p>
                ) : null}
              </div>
              <form action={deleteCompetitor}>
                <input
                  type="hidden"
                  name="competitorId"
                  value={competitor.id}
                />
                <button
                  type="submit"
                  className="text-xs text-muted-foreground transition-colors duration-300 hover:text-destructive"
                >
                  Kaldır
                </button>
              </form>
            </div>

            {competitor.ads.map((ad) => (
              <div
                key={ad.id}
                className="mt-4 border-t border-border-soft pt-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 uppercase tracking-wide",
                      ad.status === "COMPLETED" &&
                        "border-accent/40 text-accent",
                      ad.status === "FAILED" &&
                        "border-destructive/40 text-destructive",
                      (ad.status === "QUEUED" || ad.status === "RUNNING") &&
                        "animate-pulse border-border-soft",
                    )}
                  >
                    {STATUS_LABELS[ad.status]}
                  </span>
                  <span>{ad.createdAt.toLocaleString("tr-TR")}</span>
                  <AdLibraryBadge show={ad.fromAdLibrary} />
                  {ad.inputUrl ? (
                    <a
                      href={ad.inputUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent hover:opacity-80"
                    >
                      kaynak ↗
                    </a>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {ad.inputText}
                </p>
                {ad.status === "FAILED" && ad.error ? (
                  <div className="mt-2 rounded-md border border-destructive/40 p-2 text-xs">
                    {ad.error}
                  </div>
                ) : null}
                {ad.status === "COMPLETED" && ad.analysis ? (
                  <AdAnalysisView analysis={ad.analysis as AdAnalysis} />
                ) : null}
              </div>
            ))}

            <div className="mt-4 border-t border-border-soft pt-4">
              <AddAdForm competitorId={competitor.id} />
              <AdLibrarySearch competitorId={competitor.id} competitorName={competitor.name} targetMarket={brand.targetMarket} />
            </div>
          </div>
        ))
      )}

      <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Pattern analizi</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              En az {MIN_ADS_FOR_PATTERNS} analiz edilmiş reklam gerekir (şu
              an {analyzedAdCount}). Gözlemlenen pattern ile hipotez ayrı
              gösterilir.
            </p>
          </div>
          <PatternStartForm
            brandId={brand.id}
            disabled={
              analyzedAdCount < MIN_ADS_FOR_PATTERNS ||
              latestPattern?.status === "QUEUED" ||
              latestPattern?.status === "RUNNING"
            }
            disabledReason={`En az ${MIN_ADS_FOR_PATTERNS} analiz edilmiş reklam gerekir.`}
          />
        </div>

        {latestPattern ? (
          <div className="mt-4 border-t border-border-soft pt-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 uppercase tracking-wide",
                  latestPattern.status === "COMPLETED" &&
                    "border-accent/40 text-accent",
                  latestPattern.status === "FAILED" &&
                    "border-destructive/40 text-destructive",
                  (latestPattern.status === "QUEUED" ||
                    latestPattern.status === "RUNNING") &&
                    "animate-pulse border-border-soft",
                )}
              >
                {STATUS_LABELS[latestPattern.status]}
              </span>
              <span>
                {latestPattern.createdAt.toLocaleString("tr-TR")} ·{" "}
                {latestPattern.adCount} reklam
              </span>
            </div>

            {latestPattern.status === "FAILED" && latestPattern.error ? (
              <div className="mt-3 rounded-md border border-destructive/40 p-3 text-sm">
                {latestPattern.error}
              </div>
            ) : null}

            {latestPattern.status === "COMPLETED" && latestPattern.result
              ? (() => {
                  const result = latestPattern.result as PatternResult;
                  return (
                    <div className="mt-4 space-y-4">
                      {result.observed_patterns?.length ? (
                        <div>
                          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Gözlemlenen pattern&apos;ler
                          </h4>
                          <ul className="mt-2 space-y-2">
                            {result.observed_patterns.map((p, i) => (
                              <li key={i} className="text-sm">
                                {p.pattern}
                                {p.evidence ? (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    ({p.evidence})
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {result.hypotheses?.length ? (
                        <div>
                          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Hipotezler
                          </h4>
                          <ul className="mt-2 space-y-2">
                            {result.hypotheses.map((h, i) => (
                              <li
                                key={i}
                                className="flex items-start justify-between gap-3"
                              >
                                <span className="text-sm">{h.hypothesis}</span>
                                <ConfidenceBadge level={h.confidence} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {result.adaptation_notes?.length ? (
                        <div>
                          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Markana uyarlama notları
                          </h4>
                          <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                            {result.adaptation_notes.map((n, i) => (
                              <li key={i}>{n}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {result.data_gaps?.length ? (
                        <p className="text-xs text-muted-foreground">
                          Eksik veri: {result.data_gaps.join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  );
                })()
              : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
