import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/components/ui";
import { ConfidenceBadge } from "@/components/competitors/ad-analysis-view";
import {
  CopyBlock,
  PlanForm,
} from "@/components/campaigns/campaign-forms";
import {
  AddResultForm,
  AnalyzeButton,
} from "@/components/campaigns/result-forms";
import { ImportResultForm } from "@/components/campaigns/import-form";
import { MetaSyncSection } from "@/components/insights/meta-sync-section";
import { ResultSourceBadge } from "@/components/insights/source-badge";
import { ResearchPoller } from "@/components/research/research-poller";
import { computeMetrics, formatMetric } from "@/lib/results/metrics";
import type { ResultAnalysis } from "@/lib/results/run";

export const metadata = { title: "Kampanya kiti | AdScore" };
export const maxDuration = 60;

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "Sırada",
  RUNNING: "Hazırlanıyor",
  COMPLETED: "Hazır",
  FAILED: "Başarısız",
};

type PlanResult = {
  campaign_name?: string;
  objective?: {
    recommended?: string;
    reason?: string;
    confidence?: string;
    alternative?: string | null;
  };
  optimization_event?: {
    recommended?: string;
    reason?: string;
    pixel_condition?: string;
  };
  audience?: {
    suggestion?: {
      location?: string;
      age?: string;
      gender?: string;
      interests_behaviors?: string;
      advantage_plus_note?: string;
    };
    hypotheses?: Array<{ hypothesis?: string; confidence?: string }>;
  };
  placements?: { recommended?: string; reason?: string; confidence?: string };
  structure?: Array<{
    adset_name?: string;
    purpose?: string;
    creative_headlines?: string[];
    test_variable?: string | null;
  }>;
  budget_plan?: {
    scenarios?: Array<{ name?: string; allocation?: string; note?: string }>;
    disclaimer?: string;
  };
  manual_setup_steps?: string[];
  risks?: string[];
  data_gaps?: string[];
};

const SCENARIO_LABELS: Record<string, string> = {
  conservative: "Temkinli",
  recommended: "Önerilen",
  aggressive: "Agresif",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="mt-1.5 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export default async function CampaignsPage({
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
      creatives: { where: { approval: "APPROVED" } },
      campaignPlans: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          creatives: true,
          results: { orderBy: { createdAt: "desc" } },
          kits: {
            orderBy: { version: "desc" },
            take: 1,
            select: { id: true, version: true },
          },
        },
      },
      learnings: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!brand) notFound();

  const latest = brand.campaignPlans[0];
  const hasActive =
    latest?.status === "QUEUED" ||
    latest?.status === "RUNNING" ||
    brand.campaignPlans.some((p) =>
      p.results.some(
        (r) =>
          r.analysisStatus === "QUEUED" || r.analysisStatus === "RUNNING",
      ),
    );

  return (
    <div className="mx-auto w-full max-w-5xl">
      {hasActive ? <ResearchPoller /> : null}
      <Link
        href={`/app/brands/${brand.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft size={14} />
        {brand.name}
      </Link>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">Kampanya kiti</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Kit, kampanyayı Ads Manager&apos;da kendin kurman için hazırlanır (Meta
        bağlantısı gerektirmez); kurulum için gereken tüm ayarları ve onaylı
        copy&apos;leri hazır verir.
        Performans tahmini içermez; veri yokken sayı üretilmez.
      </p>

      <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6">
        <h2 className="text-sm font-medium">Yeni kurulum kiti</h2>
        <PlanForm
          brandId={brand.id}
          hasActive={hasActive}
          approvedCreatives={brand.creatives.map((c) => ({
            id: c.id,
            headline: c.headline,
          }))}
          defaultCurrency={brand.currency}
        />
      </div>

      {brand.campaignPlans.map((plan) => {
        const result = (plan.result ?? null) as PlanResult | null;
        return (
          <div
            key={plan.id}
            className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 uppercase tracking-wide",
                  plan.status === "COMPLETED" && "border-accent/40 text-accent",
                  plan.status === "FAILED" &&
                    "border-destructive/40 text-destructive",
                  (plan.status === "QUEUED" || plan.status === "RUNNING") &&
                    "animate-pulse border-border-soft",
                )}
              >
                {STATUS_LABELS[plan.status]}
              </span>
              {plan.publishedAt ? (
                <span
                  className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-accent"
                  title={plan.publishNote ?? undefined}
                >
                  Ads Manager&apos;da yayınlandı ·{" "}
                  {plan.publishedAt.toLocaleDateString("tr-TR")}
                </span>
              ) : null}
              <span>{plan.createdAt.toLocaleString("tr-TR")}</span>
              <span>
                {plan.goal} · {plan.budgetAmount.toString()} {plan.currency} (
                {plan.budgetType === "DAILY" ? "günlük" : "toplam"})
                {plan.durationDays ? ` · ${plan.durationDays} gün` : ""}
              </span>
              {plan.status === "COMPLETED" ? (
                <Link
                  href={`/app/brands/${brand.id}/campaigns/${plan.id}/kit`}
                  className="ml-auto inline-flex items-center gap-1 text-accent"
                >
                  {plan.kits.length > 0
                    ? `Kurulum kiti (v${plan.kits[0].version}) →`
                    : "Kurulum kiti →"}
                </Link>
              ) : null}
              {plan.status === "COMPLETED" ? (
                <Link href={`/app/brands/${brand.id}/campaigns/${plan.id}/publish`} className="inline-flex items-center gap-1 text-accent">Meta’da yayınla (PAUSED) →</Link>
              ) : null}
            </div>

            {plan.status === "FAILED" && plan.error ? (
              <div className="mt-4 rounded-md border border-destructive/40 p-3 text-sm">
                {plan.error}
              </div>
            ) : null}

            {plan.status === "COMPLETED" && result ? (
              <div className="mt-5 space-y-5">
                {result.campaign_name ? (
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-medium">
                      {result.campaign_name}
                    </h3>
                    <CopyBlock
                      label="Tüm kiti kopyala"
                      text={JSON.stringify(
                        { plan: result, creatives: plan.creatives },
                        null,
                        2,
                      )}
                    />
                  </div>
                ) : null}

                {result.objective ? (
                  <Section title="Kampanya objective">
                    <p>
                      <span className="font-medium">
                        {result.objective.recommended}
                      </span>{" "}
                      <ConfidenceBadge level={result.objective.confidence} />
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {result.objective.reason}
                    </p>
                    {result.objective.alternative ? (
                      <p className="mt-1 text-muted-foreground">
                        Alternatif: {result.objective.alternative}
                      </p>
                    ) : null}
                  </Section>
                ) : null}

                {result.optimization_event ? (
                  <Section title="Optimizasyon eventi">
                    <p className="font-medium">
                      {result.optimization_event.recommended}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {result.optimization_event.reason}
                    </p>
                    {result.optimization_event.pixel_condition ? (
                      <p className="mt-1 rounded-md border border-border-soft bg-muted/40 p-2 text-xs">
                        Pixel koşulu: {result.optimization_event.pixel_condition}
                      </p>
                    ) : null}
                  </Section>
                ) : null}

                {result.audience?.suggestion ? (
                  <Section title="Kitle önerisi">
                    <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                      {(
                        [
                          ["Lokasyon", result.audience.suggestion.location],
                          ["Yaş", result.audience.suggestion.age],
                          ["Cinsiyet", result.audience.suggestion.gender],
                          [
                            "İlgi / davranış",
                            result.audience.suggestion.interests_behaviors,
                          ],
                        ] as const
                      )
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-xs text-muted-foreground">
                              {k}
                            </dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                    </dl>
                    {result.audience.suggestion.advantage_plus_note ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {result.audience.suggestion.advantage_plus_note}
                      </p>
                    ) : null}
                    {result.audience.hypotheses?.length ? (
                      <ul className="mt-2 space-y-1.5">
                        {result.audience.hypotheses.map((h, i) => (
                          <li
                            key={i}
                            className="flex items-start justify-between gap-3"
                          >
                            <span>{h.hypothesis}</span>
                            <ConfidenceBadge level={h.confidence} />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </Section>
                ) : null}

                {result.placements ? (
                  <Section title="Yerleşimler">
                    <p>
                      <span className="font-medium">
                        {result.placements.recommended}
                      </span>{" "}
                      <ConfidenceBadge level={result.placements.confidence} />
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {result.placements.reason}
                    </p>
                  </Section>
                ) : null}

                {result.structure?.length ? (
                  <Section title="Kampanya yapısı">
                    <ul className="space-y-2">
                      {result.structure.map((s, i) => (
                        <li
                          key={i}
                          className="rounded-md border border-border-soft p-3"
                        >
                          <span className="font-medium">{s.adset_name}</span>
                          <p className="mt-0.5 text-muted-foreground">
                            {s.purpose}
                          </p>
                          {s.creative_headlines?.length ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Creative: {s.creative_headlines.join(" · ")}
                            </p>
                          ) : null}
                          {s.test_variable ? (
                            <p className="mt-1 text-xs">
                              Test değişkeni: {s.test_variable}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </Section>
                ) : null}

                {result.budget_plan?.scenarios?.length ? (
                  <Section title="Bütçe senaryoları (senin bütçen üzerinden)">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {result.budget_plan.scenarios.map((s, i) => (
                        <div
                          key={i}
                          className={cn(
                            "rounded-xl border p-3",
                            s.name === "recommended"
                              ? "border-accent/40"
                              : "border-border-soft",
                          )}
                        >
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {SCENARIO_LABELS[s.name ?? ""] ?? s.name}
                          </div>
                          <p className="mt-1 text-sm">{s.allocation}</p>
                          {s.note ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {s.note}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {result.budget_plan.disclaimer ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {result.budget_plan.disclaimer}
                      </p>
                    ) : null}
                  </Section>
                ) : null}

                {result.manual_setup_steps?.length ? (
                  <Section title="Ads Manager kurulum adımları (plan özeti)">
                    <ol className="list-inside list-decimal space-y-1.5">
                      {result.manual_setup_steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </Section>
                ) : null}

                <Section title="Kampanyadaki onaylı copy'ler">
                  <div className="space-y-3">
                    {plan.creatives.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-md border border-border-soft bg-muted/40 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">
                            {c.headline}
                          </span>
                          <CopyBlock
                            label="Copy'yi kopyala"
                            text={`Primary text:\n${c.primaryText}\n\nBaşlık: ${c.headline}\n${c.description ? `Açıklama: ${c.description}\n` : ""}CTA: ${c.cta}`}
                          />
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                          {c.primaryText}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          CTA: {c.cta}
                          {c.description ? ` · ${c.description}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>

                {result.risks?.length ? (
                  <Section title="Riskler">
                    <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                      {result.risks.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </Section>
                ) : null}

                {result.data_gaps?.length ? (
                  <p className="text-xs text-muted-foreground">
                    Eksik veri: {result.data_gaps.join(" · ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {plan.status === "COMPLETED" ? (
              <div
                id={`results-${plan.id}`}
                className="mt-6 scroll-mt-6 border-t border-border-soft pt-5"
              >
                <h3 className="text-sm font-medium">
                  Sonuçlar (Ads Manager&apos;dan elle giriş)
                </h3>
                {plan.publishedAt ? (
                  <p className="mt-1 text-xs text-accent">
                    Ads Manager&apos;da yayınlandı ({plan.publishedAt.toLocaleDateString("tr-TR")}
                    {plan.publishNote ? ` · ${plan.publishNote}` : ""}) — raporu
                    buraya gir.
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Sayıları Ads Manager raporundan elle veya CSV ile girebilir,
                  marka Meta&apos;ya bağlıysa doğrudan çekebilirsin. Türetilmiş
                  metrikler otomatik hesaplanır.
                </p>
                <ImportResultForm planId={plan.id} />
                <AddResultForm planId={plan.id} />
                <MetaSyncSection planId={plan.id} />

                {plan.results.map((r) => {
                  const m = computeMetrics({
                    spend: Number(r.spend),
                    impressions: r.impressions,
                    clicks: r.clicks,
                    reach: r.reach,
                    purchases: r.purchases,
                    revenue: r.revenue == null ? null : Number(r.revenue),
                  });
                  const analysis = (r.analysis ?? null) as ResultAnalysis | null;
                  return (
                    <div
                      key={r.id}
                      className="mt-4 rounded-xl border border-border-soft p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {r.periodStart.toLocaleDateString("tr-TR")} -{" "}
                          {r.periodEnd.toLocaleDateString("tr-TR")} ·{" "}
                          {r.spend.toString()} {plan.currency} harcama
                        </span>
                        <ResultSourceBadge source={r.source} notes={r.notes} />
                        <AnalyzeButton
                          resultId={r.id}
                          disabled={
                            r.analysisStatus === "QUEUED" ||
                            r.analysisStatus === "RUNNING"
                          }
                        />
                      </div>

                      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm sm:grid-cols-7">
                        {(
                          [
                            ["Gösterim", String(r.impressions)],
                            ["Tıklama", String(r.clicks)],
                            ["CTR", formatMetric(m.ctr, 2, "%")],
                            ["CPC", formatMetric(m.cpc)],
                            ["CPM", formatMetric(m.cpm)],
                            ["CPA", formatMetric(m.cpa)],
                            ["ROAS", formatMetric(m.roas)],
                          ] as const
                        ).map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {k}
                            </dt>
                            <dd className="font-medium">{v}</dd>
                          </div>
                        ))}
                      </dl>

                      {r.analysisStatus === "QUEUED" ||
                      r.analysisStatus === "RUNNING" ? (
                        <p className="mt-3 animate-pulse text-xs text-muted-foreground">
                          Analiz ediliyor...
                        </p>
                      ) : null}
                      {r.analysisStatus === "FAILED" && r.analysisError ? (
                        <div className="mt-3 rounded-md border border-destructive/40 p-2 text-xs">
                          {r.analysisError}
                        </div>
                      ) : null}
                      {r.analysisStatus === "COMPLETED" && analysis ? (
                        <div className="mt-3 space-y-3 border-t border-border-soft pt-3">
                          {analysis.diagnosis?.map((d, i) => (
                            <div key={i} className="text-sm">
                              <div className="flex items-start justify-between gap-3">
                                <span className="font-medium">
                                  {d.observation}
                                </span>
                                <ConfidenceBadge level={d.confidence} />
                              </div>
                              {d.possible_causes?.length ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Olası nedenler: {d.possible_causes.join(" · ")}
                                </p>
                              ) : null}
                              {d.evidence ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Kanıt: {d.evidence}
                                </p>
                              ) : null}
                              {d.recommended_action ? (
                                <p className="mt-1 text-xs">
                                  Öneri: {d.recommended_action}
                                </p>
                              ) : null}
                            </div>
                          ))}
                          {analysis.data_gaps?.length ? (
                            <p className="text-xs text-muted-foreground">
                              Eksik veri: {analysis.data_gaps.join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}

      {brand.learnings.length > 0 ? (
        <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6">
          <h2 className="text-sm font-medium">Öğrenmeler</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Analizlerden çıkan, bu markaya özel bulgular. Kesin gerçek değil;
            örneklem notuyla birlikte değerlendirilir ve gelecek önerilerde
            kullanılır.
          </p>
          <ul className="mt-4 space-y-3">
            {brand.learnings.map((l) => (
              <li key={l.id} className="text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span>{l.text}</span>
                  <ConfidenceBadge level={l.confidence} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Kanıt: {l.evidence} · Örneklem: {l.sampleNote}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
