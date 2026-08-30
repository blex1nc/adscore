import Link from "next/link";
import { prisma, type Brand } from "@adscore/db";
import { updateBrand } from "@/actions/brands";
import { BrandForm } from "@/components/brand-form";
import { BrandProfileSection } from "./brand-profile-section";
import { ResearchStartForm } from "@/components/research/research-start-form";
import { PatternStartForm } from "@/components/competitors/competitor-forms";
import { GenerateForm } from "@/components/creatives/creative-forms";
import type { ResearchResult } from "@/lib/research/prompt";
import { MIN_ADS_FOR_PATTERNS, type LaunchState } from "./launch-state";
import { StepPanel } from "./step-panel";

// Adım 1–4: Marka profili, Araştırma, Rakipler (opsiyonel), Arena.
// Bu bileşenler ince sarmalayıcıdır: formlar mevcut bileşenlerden gelir,
// sayfalar kopyalanmaz (AGENT-C §3).

type StepProps = { state: LaunchState; brand: Brand; wizardHref: string };

function nextHrefFor(state: LaunchState, index: number, wizardHref: string) {
  // Bu adım tamamsa bir sonrakine geç; değilse düğme gösterme
  const step = state.steps[index - 1];
  if (step.status !== "done" || index >= 8) return null;
  return `${wizardHref}?step=${index + 1}`;
}

export function ProfileStep({ state, brand, wizardHref }: StepProps) {
  const step = state.steps[0];
  const updateAction = updateBrand.bind(null, brand.id);
  return (
    <StepPanel
      step={step}
      description="Üretim kalitesi bu profile bağlı. Hazır sayılma koşulu: website + açıklama (veya ayrıştırıcı değer)."
      nextHref={nextHrefFor(state, 1, wizardHref)}
      nextLabel="Araştırmaya geç"
      detailLabel="Marka sayfasında aç"
    >
      <BrandForm
        action={updateAction}
        initial={brand}
        submitLabel="Kaydet"
        successMessage="Kaydedildi."
      />
      <div className="mt-6 border-t border-border-soft pt-5">
        <BrandProfileSection brandId={brand.id} />
      </div>
    </StepPanel>
  );
}

export async function ResearchStep({ state, brand, wizardHref }: StepProps) {
  const step = state.steps[1];
  const latest = await prisma.researchRun.findFirst({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      error: true,
      result: true,
      createdAt: true,
      model: true,
    },
  });
  const result = (latest?.result ?? null) as ResearchResult | null;
  const hasActive = latest?.status === "QUEUED" || latest?.status === "RUNNING";

  return (
    <StepPanel
      step={step}
      description="Website içeriğinden kaynak takipli marka profili. Copy üretimi ve Arena bu veriye dayanır; veri olmadan üretim yapılmaz."
      nextHref={nextHrefFor(state, 2, wizardHref)}
      nextLabel="Rakipler (opsiyonel)"
      detailLabel="Tam sonucu marka sayfasında aç"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {latest ? (
            <>
              Son koşu: {latest.createdAt.toLocaleString("tr-TR")}
              {latest.model ? ` · model: ${latest.model}` : ""}
            </>
          ) : (
            "Henüz araştırma yapılmadı."
          )}
        </div>
        <ResearchStartForm
          brandId={brand.id}
          hasActiveRun={hasActive}
          isRerun={Boolean(latest)}
        />
      </div>
      {latest?.status === "FAILED" && latest.error ? (
        <div className="mt-4 rounded-md border border-destructive/40 p-3 text-sm">
          {latest.error}
        </div>
      ) : null}
      {latest?.status === "COMPLETED" && result ? (
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          {result.brand_identity ? (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Marka kimliği
              </div>
              <p className="mt-1 leading-relaxed">{result.brand_identity}</p>
            </div>
          ) : null}
          {result.positioning ? (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Konumlanma
              </div>
              <p className="mt-1 leading-relaxed">{result.positioning}</p>
            </div>
          ) : null}
          {result.data_gaps?.length ? (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Eksik veri: {result.data_gaps.join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </StepPanel>
  );
}

export function CompetitorsStep({ state, brand, wizardHref }: StepProps) {
  const step = state.steps[2];
  const c = state.summary.competitors;
  const patternReady = c.analyzedAds >= MIN_ADS_FOR_PATTERNS;
  const patternRunning =
    c.patternStatus === "QUEUED" || c.patternStatus === "RUNNING";

  return (
    <StepPanel
      step={step}
      description="Rakip reklamlarını yapıştır, yapılandırılmış analiz çıksın; en az 3 analizden pattern üretilir. Opsiyonel: atlarsan üretim pattern verisi olmadan yapılır, güven düşer."
      nextHref={step.status === "locked" ? null : `${wizardHref}?step=4`}
      nextLabel={step.status === "done" ? "Arena'ya geç" : "Bu adımı atla"}
      detailLabel="Rakipler sayfasında aç"
    >
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Rakip
          </dt>
          <dd className="mt-0.5 font-medium tabular-nums">{c.count}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Analizli reklam
          </dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {c.analyzedAds} / {MIN_ADS_FOR_PATTERNS}
            {c.adsRunning ? (
              <span className="ml-2 animate-pulse text-xs font-normal text-muted-foreground">
                analiz sürüyor
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Pattern
          </dt>
          <dd className="mt-0.5 font-medium">
            {c.patternStatus === "COMPLETED"
              ? "Hazır"
              : patternRunning
                ? "Çıkarılıyor…"
                : c.patternStatus === "FAILED"
                  ? "Başarısız"
                  : "Yok"}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/app/brands/${brand.id}/competitors`}
          className="rounded-full border border-border-soft bg-panel px-4 py-2 text-xs font-medium transition-colors duration-300 hover:bg-muted"
        >
          Rakip ve reklam ekle →
        </Link>
        <PatternStartForm
          brandId={brand.id}
          disabled={!patternReady || patternRunning}
          disabledReason={`Pattern için en az ${MIN_ADS_FOR_PATTERNS} analiz edilmiş reklam gerekir (şu an ${c.analyzedAds}).`}
        />
      </div>
    </StepPanel>
  );
}

export function ArenaStep({ state, brand, wizardHref }: StepProps) {
  const step = state.steps[3];
  const arena = state.summary.arena;
  const arenaRunning =
    arena.latestStatus === "QUEUED" || arena.latestStatus === "RUNNING";
  const generationRunning = state.summary.creatives.generationRunning;
  const arenaHref = `/app/brands/${brand.id}/arena`;

  return (
    <StepPanel
      step={step}
      description="Arena adayları tur tur üretir, kural kontrolü ve jüri paneliyle eler; kazanan onayına düşer. Arena skoru adayların birbirine göre sıralamasıdır; gerçek performans tahmini değildir."
      nextHref={nextHrefFor(state, 4, wizardHref)}
      nextLabel="Onaya geç"
      detailLabel="Arena sayfasında aç"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={arenaHref}
          className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-85"
        >
          {arenaRunning ? "Arena sayfasında izle →" : "Arena'yı aç →"}
        </Link>
        {arena.latestStatus ? (
          <span className="text-xs text-muted-foreground">
            Son koşu: {arena.latestStatus}
            {arena.currentRound != null && arena.maxRounds != null
              ? ` · tur ${arena.currentRound}/${arena.maxRounds}`
              : ""}
            {arena.latestRunId ? (
              <>
                {" · "}
                <Link
                  href={`${arenaHref}/${arena.latestRunId}`}
                  className="text-accent hover:opacity-80"
                >
                  koşuyu aç
                </Link>
              </>
            ) : null}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Henüz Arena koşusu yok. Koşu, Arena sayfasında başlatılır.
          </span>
        )}
      </div>

      <details className="mt-5 rounded-md border border-dashed border-border-soft p-3">
        <summary className="cursor-pointer text-xs text-muted-foreground transition-colors duration-300 hover:text-foreground">
          Arena olmadan üret (Creative Studio, 3 varyant)
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Seçilim döngüsü olmadan tek seferde 3 stratejili varyant üretir.
          Araştırma verisi şart; teklif vermezsen copy&apos;de vaat kullanılmaz.
        </p>
        <GenerateForm brandId={brand.id} hasActive={generationRunning} />
      </details>
    </StepPanel>
  );
}
