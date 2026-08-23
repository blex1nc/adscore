import Link from "next/link";
import { prisma, type Brand } from "@adscore/db";
import {
  approveCreative,
  rejectCreative,
  resetCreativeApproval,
} from "@/actions/creatives";
import { cn } from "@/components/ui";
import { ConfidenceBadge } from "@/components/competitors/ad-analysis-view";
import { EditCreativeForm } from "@/components/creatives/creative-forms";
import { GenerateImageButton } from "@/components/creatives/image-button";
import { PlanForm } from "@/components/campaigns/campaign-forms";
import {
  AddResultForm,
} from "@/components/campaigns/result-forms";
import { ImportResultForm } from "@/components/campaigns/import-form";
import { PreviewTabs } from "@/components/preview/preview-tabs";
import type { LaunchState } from "./launch-state";
import { StepPanel } from "./step-panel";

// Adım 5–8: Onay (önizlemeli), Plan (bütçe kullanıcıdan), Kit & yayın, Sonuç.

type StepProps = { state: LaunchState; brand: Brand; wizardHref: string };

function nextHrefFor(state: LaunchState, index: number, wizardHref: string) {
  const step = state.steps[index - 1];
  if (step.status !== "done" || index >= 8) return null;
  return `${wizardHref}?step=${index + 1}`;
}

const APPROVAL_LABELS: Record<string, string> = {
  PENDING: "Onay bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
};

const APPROVAL_ORDER: Record<string, number> = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
};

export async function ApprovalStep({ state, brand, wizardHref }: StepProps) {
  const step = state.steps[4];
  const creatives = await prisma.creative.findMany({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
    include: {
      generation: { select: { offer: true } },
      images: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const sorted = [...creatives].sort(
    (a, b) => APPROVAL_ORDER[a.approval] - APPROVAL_ORDER[b.approval],
  );
  const rejected = sorted.filter((c) => c.approval === "REJECTED");
  const visible = sorted.filter((c) => c.approval !== "REJECTED");
  const logoUrl = state.summary.bridge.logoAssetId
    ? `/api/brand-assets/${state.summary.bridge.logoAssetId}`
    : null;

  return (
    <StepPanel
      step={step}
      description="Yayına hiçbir şey onaysız girmez. Her creative'i Akış / Hikâye / Reels çerçevesinde gör, onayla, reddet veya düzenle (düzenlenen yeniden onaya düşer)."
      nextHref={nextHrefFor(state, 5, wizardHref)}
      nextLabel="Plana geç"
      detailLabel="Creative Studio'da aç"
    >
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {state.summary.creatives.generationRunning
            ? "Creative üretimi sürüyor…"
            : "Onay bekleyen veya onaylı creative yok."}
        </p>
      ) : null}

      <div className="space-y-6">
        {visible.map((creative) => (
          <div
            key={creative.id}
            className="rounded-xl border border-border p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 uppercase tracking-wide",
                    creative.approval === "APPROVED" &&
                      "border-accent/40 text-accent",
                    creative.approval === "PENDING" && "border-border",
                  )}
                >
                  {APPROVAL_LABELS[creative.approval]}
                </span>
                <span className="font-medium text-foreground">
                  {creative.strategy}
                </span>
                {creative.editedAt ? <span>düzenlendi</span> : null}
                <ConfidenceBadge level={creative.confidence} />
              </div>
              <div className="flex items-center gap-2">
                {creative.approval !== "APPROVED" ? (
                  <form action={approveCreative}>
                    <input type="hidden" name="creativeId" value={creative.id} />
                    <button
                      type="submit"
                      className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-85"
                    >
                      Onayla
                    </button>
                  </form>
                ) : null}
                <form action={rejectCreative}>
                  <input type="hidden" name="creativeId" value={creative.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-border px-3.5 py-1.5 text-xs text-muted-foreground transition-colors duration-300 hover:text-destructive"
                  >
                    Reddet
                  </button>
                </form>
                {creative.approval !== "PENDING" ? (
                  <form action={resetCreativeApproval}>
                    <input type="hidden" name="creativeId" value={creative.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-border px-3.5 py-1.5 text-xs text-muted-foreground transition-colors duration-300 hover:text-foreground"
                    >
                      Geri al
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0 space-y-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Hook
                  </div>
                  <p className="mt-0.5">{creative.hook}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {creative.primaryText}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                    <span className="font-medium">{creative.headline}</span>
                    {creative.description ? (
                      <span className="text-muted-foreground">
                        · {creative.description}
                      </span>
                    ) : null}
                    <span className="ml-auto rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                      {creative.cta}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {creative.targetNote ? (
                    <p>Hedef: {creative.targetNote}</p>
                  ) : null}
                  <p>Neden: {creative.why}</p>
                  {creative.generation.offer ? (
                    <p>Teklif (kullanıcı girdisi): {creative.generation.offer}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
                  <GenerateImageButton
                    creativeId={creative.id}
                    hasActive={
                      creative.images[0]?.status === "QUEUED" ||
                      creative.images[0]?.status === "RUNNING"
                    }
                  />
                  {creative.images[0]?.status === "FAILED" &&
                  creative.images[0].error ? (
                    <span className="text-xs text-destructive">
                      Görsel üretilemedi: {creative.images[0].error}
                    </span>
                  ) : null}
                </div>
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground transition-colors duration-300 hover:text-foreground">
                    Düzenle
                  </summary>
                  <EditCreativeForm
                    creativeId={creative.id}
                    initial={{
                      primaryText: creative.primaryText,
                      headline: creative.headline,
                      description: creative.description,
                      cta: creative.cta,
                    }}
                  />
                </details>
              </div>
              <PreviewTabs
                compact
                creative={{
                  primaryText: creative.primaryText,
                  headline: creative.headline,
                  description: creative.description,
                  cta: creative.cta,
                }}
                imageUrl={
                  creative.images[0]?.status === "COMPLETED"
                    ? `/api/creative-images/${creative.images[0].id}`
                    : null
                }
                brand={{ name: brand.name, logoUrl }}
              />
            </div>
          </div>
        ))}
      </div>

      {rejected.length ? (
        <p className="mt-4 text-xs text-muted-foreground">
          {rejected.length} reddedilmiş creative gizlendi — Creative Studio&apos;da
          geri alabilirsin.
        </p>
      ) : null}
    </StepPanel>
  );
}

const PLAN_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Sırada",
  RUNNING: "Hazırlanıyor",
  COMPLETED: "Hazır",
  FAILED: "Başarısız",
};

export async function PlanStep({ state, brand, wizardHref }: StepProps) {
  const step = state.steps[5];
  const [approved, latestPlan] = await Promise.all([
    prisma.creative.findMany({
      where: { brandId: brand.id, approval: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, headline: true },
    }),
    prisma.campaignPlan.findFirst({
      where: { brandId: brand.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        error: true,
        goal: true,
        budgetAmount: true,
        currency: true,
        budgetType: true,
        createdAt: true,
      },
    }),
  ]);
  const hasActive =
    latestPlan?.status === "QUEUED" || latestPlan?.status === "RUNNING";

  return (
    <StepPanel
      step={step}
      description="Bütçeyi sen belirlersin; sistem bütçe koymaz. Plan, objective/optimizasyon/kitle/yerleşim önerilerini neden + güven düzeyiyle ve senin bütçen üzerinden senaryolarla verir."
      nextHref={nextHrefFor(state, 6, wizardHref)}
      nextLabel="Kit & yayına geç"
      detailLabel="Kampanya sayfasında aç"
    >
      {latestPlan ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 uppercase tracking-wide",
              latestPlan.status === "COMPLETED" && "border-accent/40 text-accent",
              latestPlan.status === "FAILED" &&
                "border-destructive/40 text-destructive",
              hasActive && "animate-pulse border-border",
            )}
          >
            {PLAN_STATUS_LABELS[latestPlan.status]}
          </span>
          <span>
            Son plan: {latestPlan.createdAt.toLocaleString("tr-TR")} ·{" "}
            {latestPlan.goal} · {latestPlan.budgetAmount.toString()}{" "}
            {latestPlan.currency} (
            {latestPlan.budgetType === "DAILY" ? "günlük" : "toplam"})
          </span>
          {latestPlan.status === "COMPLETED" ? (
            <Link
              href={`/app/brands/${brand.id}/campaigns`}
              className="text-accent hover:opacity-80"
            >
              planı gör →
            </Link>
          ) : null}
        </div>
      ) : null}
      {latestPlan?.status === "FAILED" && latestPlan.error ? (
        <div className="mb-4 rounded-md border border-destructive/40 p-3 text-sm">
          {latestPlan.error}
        </div>
      ) : null}
      <h3 className="text-sm font-medium">
        {latestPlan?.status === "COMPLETED" ? "Yeni plan" : "Plan hazırla"}
      </h3>
      <PlanForm
        brandId={brand.id}
        hasActive={hasActive}
        approvedCreatives={approved}
        defaultCurrency={brand.currency}
      />
    </StepPanel>
  );
}

export async function KitStep({ state, brand, wizardHref }: StepProps) {
  const step = state.steps[6];
  const planId = state.summary.plan.latestId;
  const plan = planId
    ? await prisma.campaignPlan.findFirst({
        where: { id: planId, brandId: brand.id },
        select: {
          id: true,
          status: true,
          goal: true,
          budgetAmount: true,
          currency: true,
          budgetType: true,
          createdAt: true,
          _count: { select: { creatives: true } },
        },
      })
    : null;
  const publishedAt = state.summary.plan.publishedAt;

  return (
    <StepPanel
      step={step}
      description="Panel Meta'ya bağlı değil; kampanyayı Ads Manager'da sen kurarsın. Kit, alan alan kopyala-yapıştır ayarları ve onaylı copy'leri verir. Kurduktan sonra kit sayfasında 'yayınladım' işaretle."
      nextHref={nextHrefFor(state, 7, wizardHref)}
      nextLabel="Sonuç girişine geç"
      detailLabel="Kurulum kitini aç"
    >
      {plan ? (
        <div className="space-y-4 text-sm">
          <div className="text-muted-foreground">
            Plan: {plan.createdAt.toLocaleString("tr-TR")} · {plan.goal} ·{" "}
            {plan.budgetAmount.toString()} {plan.currency} (
            {plan.budgetType === "DAILY" ? "günlük" : "toplam"}) ·{" "}
            {plan._count.creatives} onaylı creative
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/app/brands/${brand.id}/campaigns/${plan.id}/kit`}
              className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-85"
            >
              Kurulum kiti →
            </Link>
            <Link
              href={`/app/brands/${brand.id}/campaigns`}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium transition-colors duration-300 hover:bg-muted"
            >
              Plan ve manuel kit →
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            {publishedAt
              ? `Ads Manager'da yayınlandı olarak işaretlendi: ${publishedAt.toLocaleString("tr-TR")}`
              : "Henüz 'yayınladım' işareti yok — işaret kit sayfasında verilir."}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Tamamlanmış plan yok.</p>
      )}
    </StepPanel>
  );
}

export async function ResultsStep({ state, brand }: StepProps) {
  const step = state.steps[7];
  const planId = state.summary.plan.latestId;
  const plan = planId
    ? await prisma.campaignPlan.findFirst({
        where: { id: planId, brandId: brand.id, status: "COMPLETED" },
        select: {
          id: true,
          currency: true,
          results: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              periodStart: true,
              periodEnd: true,
              spend: true,
              impressions: true,
              clicks: true,
              analysisStatus: true,
            },
          },
        },
      })
    : null;

  return (
    <StepPanel
      step={step}
      description="Ads Manager raporundaki gerçek sayıları gir (CSV veya elle). Türetilmiş metrikler koddan hesaplanır; analiz ve öğrenmeler kampanya sayfasında, skor ve öneriler optimizasyonda."
      detailLabel="Kampanya sayfasında aç"
    >
      {plan ? (
        <>
          {plan.results.length ? (
            <ul className="mb-4 space-y-1.5 text-sm">
              {plan.results.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-x-3 text-muted-foreground">
                  <span className="text-foreground">
                    {r.periodStart.toLocaleDateString("tr-TR")} –{" "}
                    {r.periodEnd.toLocaleDateString("tr-TR")}
                  </span>
                  <span>
                    {r.spend.toString()} {plan.currency} · {r.impressions}{" "}
                    gösterim · {r.clicks} tıklama
                  </span>
                  {r.analysisStatus ? (
                    <span className="text-xs">analiz: {r.analysisStatus}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">
              Henüz sonuç girilmedi.
            </p>
          )}
          <ImportResultForm planId={plan.id} />
          <AddResultForm planId={plan.id} />
          <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4">
            <Link
              href={`/app/brands/${brand.id}/campaigns`}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium transition-colors duration-300 hover:bg-muted"
            >
              Analiz ve öğrenmeler →
            </Link>
            <Link
              href={`/app/brands/${brand.id}/optimization`}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium transition-colors duration-300 hover:bg-muted"
            >
              Optimizasyon →
            </Link>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Tamamlanmış plan yok.</p>
      )}
    </StepPanel>
  );
}
