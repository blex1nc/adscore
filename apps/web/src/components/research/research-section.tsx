import { prisma } from "@adscore/db";
import type { ResearchResult } from "@/lib/research/prompt";
import { cn } from "@/components/ui";
import { AddCandidateButton } from "@/components/competitors/competitor-forms";
import { ResearchPoller } from "./research-poller";
import { ResearchStartForm } from "./research-start-form";

function ConfidenceBadge({ level }: { level?: string }) {
  const label =
    level === "high" ? "yüksek" : level === "medium" ? "orta" : "düşük";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
        level === "high"
          ? "border-accent/40 text-accent"
          : "border-border-soft text-muted-foreground",
      )}
      title={`Confidence: ${label}`}
    >
      {label}
    </span>
  );
}

const COMPETITOR_TYPES: Record<string, string> = {
  direct: "Doğrudan",
  indirect: "Dolaylı",
  aspirational: "Aspirasyonel",
  creative: "Creative",
};

function ResultView({
  result,
  brandId,
}: {
  result: ResearchResult;
  brandId: string;
}) {
  return (
    <div className="space-y-5">
      {result.brand_identity ? (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Marka kimliği
          </h4>
          <p className="mt-1 text-sm leading-relaxed">
            {result.brand_identity}
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {result.positioning ? (
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Konumlanma
            </h4>
            <p className="mt-1 text-sm leading-relaxed">
              {result.positioning}
            </p>
          </div>
        ) : null}
        {result.tone_of_voice ? (
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ton
            </h4>
            <p className="mt-1 text-sm leading-relaxed">
              {result.tone_of_voice}
            </p>
          </div>
        ) : null}
        {result.market?.niche || result.market?.category ? (
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pazar
            </h4>
            <p className="mt-1 text-sm">
              {[result.market?.category, result.market?.niche]
                .filter(Boolean)
                .join(" / ")}
            </p>
          </div>
        ) : null}
      </div>

      {result.products_services?.length ? (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ürün ve hizmetler
          </h4>
          <ul className="mt-2 space-y-1.5">
            {result.products_services.map((p, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{p.name}</span>
                {p.note ? (
                  <span className="text-muted-foreground"> — {p.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.value_propositions?.length ? (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Değer önerileri
          </h4>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
            {result.value_propositions.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.audience_hypotheses?.length ? (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Hedef kitle hipotezleri
          </h4>
          <ul className="mt-2 space-y-2">
            {result.audience_hypotheses.map((h, i) => (
              <li key={i} className="flex items-start justify-between gap-3">
                <span className="text-sm">{h.hypothesis}</span>
                <ConfidenceBadge level={h.confidence} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.competitor_candidates?.length ? (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Rakip adayları
          </h4>
          <ul className="mt-2 space-y-2">
            {result.competitor_candidates.map((c, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {COMPETITOR_TYPES[c.type ?? ""] ?? c.type}
                </span>
                {c.name ? (
                  <span className="ml-3">
                    <AddCandidateButton
                      brandId={brandId}
                      name={c.name}
                      type={c.type ?? "DIRECT"}
                      reason={c.reason}
                    />
                  </span>
                ) : null}
                {c.reason ? (
                  <p className="mt-0.5 text-muted-foreground">{c.reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Bunlar modelin website içeriğinden çıkardığı adaylardır; doğrulama
            ve reklam analizi Rakipler bölümünde yapılır.
          </p>
        </div>
      ) : null}

      {result.hypotheses?.length ? (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Diğer hipotezler
          </h4>
          <ul className="mt-2 space-y-2">
            {result.hypotheses.map((h, i) => (
              <li key={i} className="flex items-start justify-between gap-3">
                <span className="text-sm">{h.hypothesis}</span>
                <ConfidenceBadge level={h.confidence} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.data_gaps?.length ? (
        <div className="rounded-md border border-border-soft bg-muted/50 p-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Eksik veri
          </h4>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {result.data_gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "Sırada",
  RUNNING: "Araştırılıyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
};

export async function ResearchSection({ brandId }: { brandId: string }) {
  const runs = await prisma.researchRun.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { sources: true },
  });
  const latest = runs[0];
  const hasActiveRun =
    latest?.status === "QUEUED" || latest?.status === "RUNNING";

  return (
    <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6">
      {hasActiveRun ? <ResearchPoller /> : null}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">Marka araştırması</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Website içeriğinden kaynak takipli marka profili çıkarır. Gözlem
            ile hipotez ayrıdır; her hipotezin güven düzeyi görünür.
          </p>
        </div>
        <ResearchStartForm
          brandId={brandId}
          hasActiveRun={hasActiveRun}
          isRerun={runs.length > 0}
        />
      </div>

      {latest ? (
        <div className="mt-5 border-t border-border-soft pt-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 uppercase tracking-wide",
                latest.status === "COMPLETED" && "border-accent/40 text-accent",
                latest.status === "FAILED" &&
                  "border-destructive/40 text-destructive",
                hasActiveRun && "border-border-soft animate-pulse",
              )}
            >
              {STATUS_LABELS[latest.status]}
            </span>
            <span>{latest.createdAt.toLocaleString("tr-TR")}</span>
            {latest.model ? <span>model: {latest.model}</span> : null}
            {latest.promptTokens != null && latest.outputTokens != null ? (
              <span>
                token: {latest.promptTokens}+{latest.outputTokens}
              </span>
            ) : null}
          </div>

          {latest.status === "FAILED" && latest.error ? (
            <div className="mt-4 rounded-md border border-destructive/40 p-3 text-sm">
              {latest.error}
            </div>
          ) : null}

          {latest.status === "COMPLETED" && latest.result ? (
            <div className="mt-4">
              <ResultView
                result={latest.result as ResearchResult}
                brandId={brandId}
              />
              {latest.sources.length ? (
                <div className="mt-5 border-t border-border-soft pt-3 text-xs text-muted-foreground">
                  Kaynaklar:{" "}
                  {latest.sources.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 ? " · " : ""}
                      {s.url} ({s.reliability},{" "}
                      {s.retrievedAt.toLocaleString("tr-TR")})
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {runs.length > 1 ? (
            <details className="mt-4 text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                Önceki araştırmalar ({runs.length - 1})
              </summary>
              <ul className="mt-2 space-y-1">
                {runs.slice(1).map((run) => (
                  <li key={run.id}>
                    {run.createdAt.toLocaleString("tr-TR")} —{" "}
                    {STATUS_LABELS[run.status]}
                    {run.error ? ` (${run.error.slice(0, 80)})` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 border-t border-border-soft pt-5 text-sm text-muted-foreground">
          Henüz araştırma yapılmadı.
        </p>
      )}
    </div>
  );
}
