import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/components/ui";
import { ConfidenceBadge } from "@/components/competitors/ad-analysis-view";
import {
  DecideButtons,
  StartOptimizationForm,
} from "@/components/optimization/optimization-forms";
import { ResearchPoller } from "@/components/research/research-poller";
import { computeMetrics, formatMetric } from "@/lib/results/metrics";
import {
  computeBrandScores,
  isEligibleForScore,
  SCORE_METRIC_LABELS,
  type ScoreableResult,
} from "@/lib/optimization/adscore";
import { detectSignals, SIGNAL_LABELS } from "@/lib/optimization/signals";
import type { OptimizationResult } from "@/lib/optimization/prompts";

export const metadata = { title: "Optimizasyon | AdScore" };
export const maxDuration = 60;

const RUN_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Sırada",
  RUNNING: "Analiz ediliyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
};

const REC_STATUS_LABELS: Record<string, string> = {
  ACCEPTED: "Kabul edildi",
  DISMISSED: "Reddedildi",
};

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-sm font-semibold tabular-nums",
        score >= 60 && "border-accent/40 text-accent",
        score < 60 && score >= 40 && "border-border-soft text-foreground",
        score < 40 && "border-destructive/40 text-destructive",
      )}
    >
      {score}
    </span>
  );
}

export default async function OptimizationPage({
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
      campaignPlans: {
        where: { results: { some: {} } },
        orderBy: { createdAt: "desc" },
        include: { results: { orderBy: { periodStart: "asc" } } },
      },
      optimizationRuns: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { recommendations: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!brand) notFound();

  // Skor ve sinyaller her görüntülemede koddan hesaplanır (AI'sız, deterministik)
  const scoreablePlans = brand.campaignPlans.map((plan) => ({
    id: plan.id,
    results: plan.results.map(
      (r): ScoreableResult => ({
        id: r.id,
        planId: plan.id,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        impressions: r.impressions,
        clicks: r.clicks,
        metrics: computeMetrics({
          spend: Number(r.spend),
          impressions: r.impressions,
          clicks: r.clicks,
          reach: r.reach,
          purchases: r.purchases,
          revenue: r.revenue == null ? null : Number(r.revenue),
        }),
      }),
    ),
  }));
  const scores = computeBrandScores(scoreablePlans.flatMap((p) => p.results));
  const signals = detectSignals(scoreablePlans);
  const canDetectSignals = scoreablePlans.some(
    (p) => p.results.filter(isEligibleForScore).length >= 2,
  );

  const hasActiveRun = brand.optimizationRuns.some(
    (r) => r.status === "QUEUED" || r.status === "RUNNING",
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      {hasActiveRun ? <ResearchPoller /> : null}
      <Link
        href={`/app/brands/${brand.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft size={14} />
        {brand.name}
      </Link>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">Optimizasyon</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        AdScore, bir sonucun bu markanın KENDİ geçmişine göre göreli skorudur
        (50 = marka medyanı) — sektör benchmark’ı değildir. Skorlar ve
        sinyaller koddan hesaplanır; AI yalnız yorumlar ve öneri sunar.
        Hiçbir öneri otomatik uygulanmaz.
      </p>

      <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6">
        <h2 className="text-sm font-medium">AdScore — kampanya sonuçları</h2>
        {brand.campaignPlans.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Henüz sonuç girilmiş kampanya yok. Önce{" "}
            <Link
              href={`/app/brands/${brand.id}/campaigns`}
              className="text-accent"
            >
              kampanya kitinden
            </Link>{" "}
            sonuç gir.
          </p>
        ) : null}
        {brand.campaignPlans.map((plan) => (
          <div
            key={plan.id}
            className="mt-4 rounded-xl border border-border-soft p-4"
          >
            <div className="text-xs text-muted-foreground">
              {plan.goal} · {plan.budgetAmount.toString()} {plan.currency} (
              {plan.budgetType === "DAILY" ? "günlük" : "toplam"}) ·{" "}
              {plan.createdAt.toLocaleDateString("tr-TR")}
            </div>
            {plan.results.map((r) => {
              const score = scores.get(r.id);
              return (
                <div
                  key={r.id}
                  className="mt-3 border-t border-border-soft pt-3 first:mt-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {r.periodStart.toLocaleDateString("tr-TR")} -{" "}
                      {r.periodEnd.toLocaleDateString("tr-TR")} ·{" "}
                      {r.impressions} gösterim / {r.clicks} tıklama
                    </span>
                    {score?.eligible ? <ScoreBadge score={score.score} /> : null}
                  </div>
                  {score?.eligible ? (
                    <>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {score.components.map((c) => (
                          <span
                            key={c.metric}
                            className="rounded-md border border-border-soft bg-muted/40 px-2 py-1 text-xs"
                            title={`Marka medyanı: ${formatMetric(c.brandMedian)} (${c.comparisonCount} sonuç)`}
                          >
                            {SCORE_METRIC_LABELS[c.metric]}:{" "}
                            <span className="font-medium">{c.score}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              ({formatMetric(c.value)} / medyan{" "}
                              {formatMetric(c.brandMedian)})
                            </span>
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {score.coverageNote}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {score?.reason ?? "Skor hesaplanamadı."}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6">
        <h2 className="text-sm font-medium">Gözlenen sinyaller</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Aynı kampanyanın ardışık iki dönem sonucu arasındaki gerçek
          değişimler. Yorum değil gözlemdir; “neden” sorusu AI analizinde ele
          alınır.
        </p>
        {!canDetectSignals ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sinyal tespiti için aynı kampanyada yeterli veriye sahip en az 2
            dönem sonucu gerekir.
          </p>
        ) : signals.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Son iki dönem kıyasında eşik üstü (%20; yorgunlukta %15 CTR + %10
            frekans) değişim gözlenmedi.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {signals.map((s, i) => (
              <li key={i} className="rounded-md border border-border-soft p-3">
                <span className="text-sm font-medium">
                  {SIGNAL_LABELS[s.kind]}
                </span>
                <p className="mt-1 text-sm">{s.observation}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.evidence}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6">
        <h2 className="text-sm font-medium">AI optimizasyon analizi</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Skorlar, sinyaller ve marka öğrenmeleri AI’a verilir; teşhis + kanıtlı
          öneriler + tek değişkenli sonraki test önerisi döner. Önerileri sen
          karara bağlarsın; kabul bile hiçbir şeyi otomatik değiştirmez.
        </p>
        <StartOptimizationForm brandId={brand.id} hasActive={hasActiveRun} />

        {brand.optimizationRuns.map((run) => {
          const result = (run.result ?? null) as OptimizationResult | null;
          return (
            <div
              key={run.id}
              className="mt-5 rounded-xl border border-border-soft p-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 uppercase tracking-wide",
                    run.status === "COMPLETED" &&
                      "border-accent/40 text-accent",
                    run.status === "FAILED" &&
                      "border-destructive/40 text-destructive",
                    (run.status === "QUEUED" || run.status === "RUNNING") &&
                      "animate-pulse border-border-soft",
                  )}
                >
                  {RUN_STATUS_LABELS[run.status]}
                </span>
                <span>{run.createdAt.toLocaleString("tr-TR")}</span>
                <span>{run.resultCount} yeterli-veri sonucu üzerinden</span>
              </div>

              {run.status === "FAILED" && run.error ? (
                <div className="mt-3 rounded-md border border-destructive/40 p-3 text-sm">
                  {run.error}
                </div>
              ) : null}

              {run.status === "COMPLETED" ? (
                <div className="mt-3 space-y-4">
                  {result?.summary ? (
                    <p className="text-sm">{result.summary}</p>
                  ) : null}
                  {run.recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="rounded-md border border-border-soft p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {rec.kind === "test" ? (
                            <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent">
                              Test önerisi
                            </span>
                          ) : null}
                          <span className="text-sm font-medium">
                            {rec.observation}
                          </span>
                          <ConfidenceBadge level={rec.confidence} />
                        </div>
                        {rec.status === "PROPOSED" ? (
                          <DecideButtons recommendationId={rec.id} />
                        ) : (
                          <span
                            className={cn(
                              "text-xs",
                              rec.status === "ACCEPTED"
                                ? "text-accent"
                                : "text-muted-foreground",
                            )}
                          >
                            {REC_STATUS_LABELS[rec.status]}
                          </span>
                        )}
                      </div>
                      {rec.causes ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Olası nedenler: {rec.causes}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Kanıt: {rec.evidence}
                      </p>
                      <p className="mt-1.5 text-sm">Öneri: {rec.action}</p>
                    </div>
                  ))}
                  {result?.data_gaps?.length ? (
                    <p className="text-xs text-muted-foreground">
                      Eksik veri: {result.data_gaps.join(" · ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
