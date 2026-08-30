import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma, type EvolutionCandidate, type EvolutionStage } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/components/ui";
import { ConfidenceBadge } from "@/components/competitors/ad-analysis-view";
import {
  CancelRunButton,
  PromoteCandidateButton,
} from "@/components/evolution/arena-forms";
import { ArenaPoller } from "@/components/evolution/arena-poller";
import {
  ARENA_DISCLAIMER,
  GOAL_LABELS,
  ORIGIN_LABELS,
  RUN_STATUS_LABELS,
  STAGE_LABELS,
} from "@/lib/evolution/constants";
import {
  parseConfig,
  type EvolutionSummary,
  type JudgeBreakdown,
} from "@/lib/evolution/run";
import { JUDGE_DIMENSION_LABELS, JUDGE_PERSONAS } from "@/lib/evolution/select";
import type { LintIssue } from "@/lib/evolution/lint";

export const metadata = { title: "Arena koşusu | AdScore" };
export const maxDuration = 60;

const STAGES: EvolutionStage[] = ["GENERATE", "LINT", "JUDGE", "SELECT", "DONE"];

function num(v: unknown, digits = 1): string {
  if (v === null || v === undefined) return "–";
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "–";
}

function StageChips({ stage }: { stage: EvolutionStage }) {
  const idx = STAGES.indexOf(stage);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {STAGES.map((s, i) => (
        <span
          key={s}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
            i < idx && "border-accent/40 text-accent",
            i === idx && s !== "DONE" && "border-foreground text-foreground",
            i === idx && s === "DONE" && "border-accent/40 text-accent",
            i > idx && "border-border-soft text-muted-foreground",
          )}
        >
          {STAGE_LABELS[s]}
        </span>
      ))}
    </div>
  );
}

function ScoreCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-soft px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function CandidateCard({
  c,
  runId,
  runCompleted,
  promotedIds,
  brandId,
  labelById,
}: {
  c: EvolutionCandidate;
  runId: string;
  runCompleted: boolean;
  promotedIds: Set<string>;
  brandId: string;
  labelById: Map<string, string>;
}) {
  const issues = (c.lintIssues as LintIssue[] | null) ?? [];
  const breakdown = c.judgeBreakdown as JudgeBreakdown | null;
  const eliminated = !!c.eliminatedReason;
  return (
    <div
      id={`cand-${c.id}`}
      className={cn(
        "rounded-xl border p-4",
        eliminated ? "border-border-soft opacity-70" : "border-border-soft",
        c.rank === 1 && !eliminated && "border-accent/50",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono text-[11px] tracking-[0.15em]">
          {labelById.get(c.id) ?? c.id.slice(-4)}
        </span>
        <span className="rounded-full border border-border-soft px-2 py-0.5 uppercase tracking-wide">
          {ORIGIN_LABELS[c.origin] ?? c.origin}
        </span>
        {c.rank ? (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 uppercase tracking-wide",
              c.rank === 1 ? "border-accent/40 text-accent" : "border-border-soft",
            )}
          >
            {c.rank}. sıra
          </span>
        ) : null}
        {c.survived ? (
          <span className="rounded-full border border-accent/40 px-2 py-0.5 uppercase tracking-wide text-accent">
            elit
          </span>
        ) : null}
        {eliminated ? (
          <span className="rounded-full border border-destructive/40 px-2 py-0.5 uppercase tracking-wide text-destructive">
            elendi
          </span>
        ) : null}
        {c.parentId ? (
          <a
            href={`#cand-${c.parentId}`}
            className="underline underline-offset-4 transition-colors duration-300 hover:text-foreground"
          >
            ebeveyn: {labelById.get(c.parentId) ?? c.parentId.slice(-4)}
          </a>
        ) : null}
        {promotedIds.has(c.id) ? (
          <Link
            href={`/app/brands/${brandId}/creatives`}
            className="ml-auto text-accent underline underline-offset-4"
          >
            Onay akışına gönderildi → Creative Studio
          </Link>
        ) : runCompleted && !eliminated ? (
          <div className="ml-auto">
            <PromoteCandidateButton runId={runId} candidateId={c.id} />
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ScoreCell label="Lint" value={String(c.lintScore)} />
        <ScoreCell label="Jüri" value={num(c.judgeScore)} />
        <ScoreCell label="Borda" value={num(breakdown?.borda)} />
        <ScoreCell label="Toplam" value={num(c.totalScore)} />
      </div>

      {eliminated ? (
        <p className="mt-3 rounded-md border border-destructive/40 px-3 py-2 text-xs">
          Elenme nedeni: {c.eliminatedReason}
        </p>
      ) : null}

      <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Strateji
          </div>
          <p className="mt-0.5">{c.strategy}</p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Hook
          </div>
          <p className="mt-0.5">{c.hook}</p>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-border-soft bg-muted/40 p-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {c.primaryText}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border-soft pt-2 text-sm">
          <span className="font-medium">{c.headline}</span>
          {c.description ? (
            <span className="text-muted-foreground">· {c.description}</span>
          ) : null}
          <span className="ml-auto rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            {c.cta}
          </span>
        </div>
      </div>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {c.targetNote ? <p>Hedef: {c.targetNote}</p> : null}
        <p>Neden: {c.why}</p>
      </div>

      {issues.filter((i) => i.severity === "soft").length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {issues
            .filter((i) => i.severity === "soft")
            .map((i, k) => (
              <li key={k}>
                kural {i.rule}: {i.message}
              </li>
            ))}
        </ul>
      ) : null}

      {breakdown && Object.keys(breakdown.judges).length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground transition-colors duration-300 hover:text-foreground">
            Jüri eleştirileri ({Object.keys(breakdown.judges).length} jüri
            {breakdown.judgeStd !== null ? `, uyum sapması ${num(breakdown.judgeStd)}` : ""})
          </summary>
          <div className="mt-2 space-y-2">
            {Object.entries(breakdown.judges).map(([key, j]) => (
              <div key={key} className="rounded-md border border-border-soft p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {JUDGE_PERSONAS.find((p) => p.key === key)?.label ?? key}
                  </span>
                  <span className="text-muted-foreground">
                    ağırlıklı {num(j.weighted)} · {j.rank ?? "?"}. sıra
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {Object.entries(j.scores)
                      .map(
                        ([d, v]) =>
                          `${JUDGE_DIMENSION_LABELS[d as keyof typeof JUDGE_DIMENSION_LABELS] ?? d} ${v ?? "–"}`,
                      )
                      .join(" · ")}
                  </span>
                </div>
                {j.critique ? <p className="mt-1">{j.critique}</p> : null}
                {j.suggestedMutation ? (
                  <p className="mt-1 text-muted-foreground">
                    Önerilen mutasyon: {j.suggestedMutation}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export default async function ArenaRunPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id, runId } = await params;
  const user = await getCurrentUser();
  if (!user?.workspace) redirect("/login");

  const brand = await prisma.brand.findFirst({
    where: { id, workspaceId: user.workspace.id },
    select: { id: true, name: true },
  });
  if (!brand) notFound();
  const run = await prisma.evolutionRun.findFirst({
    where: { id: runId, brandId: brand.id },
    include: {
      rounds: { orderBy: { index: "asc" } },
      candidates: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!run) notFound();

  const cfg = parseConfig(run.config);
  const summary = run.summary as EvolutionSummary | null;
  const isActive = run.status === "QUEUED" || run.status === "RUNNING";
  // Otomatik + manuel aktarılanlar (promoteCandidatesInternal summary'yi günceller)
  const promotedIds = new Set(summary?.promotedCandidateIds ?? []);

  // Etiketler: tur içi sıra (T1-A3 gibi) — okunabilirlik için
  const labelById = new Map<string, string>();
  for (const r of run.rounds) {
    run.candidates
      .filter((c) => c.roundId === r.id)
      .forEach((c, i) => labelById.set(c.id, `T${r.index + 1}-A${i + 1}`));
  }
  const winner = summary
    ? run.candidates.find((c) => c.id === summary.winnerCandidateId)
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {isActive ? <ArenaPoller runId={run.id} /> : null}
      <Link
        href={`/app/brands/${brand.id}/arena`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Arena · {brand.name}
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Koşu</h1>
        {isActive ? <CancelRunButton runId={run.id} /> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 uppercase tracking-wide",
            run.status === "COMPLETED" && "border-accent/40 text-accent",
            run.status === "FAILED" && "border-destructive/40 text-destructive",
            isActive && "border-foreground text-foreground",
            run.status === "CANCELLED" && "border-border-soft",
          )}
        >
          {RUN_STATUS_LABELS[run.status]}
        </span>
        <span>{GOAL_LABELS[run.goal] ?? run.goal}</span>
        <span>
          · {cfg.rounds} tur × {cfg.population} aday × {cfg.survivors} elit ×{" "}
          {cfg.judges} jüri
        </span>
        {isActive ? (
          <span>
            · tur {run.currentRound + 1} / {run.maxRounds}
          </span>
        ) : null}
        {run.model ? <span>· {run.model}</span> : null}
        {run.promptTokens !== null || run.outputTokens !== null ? (
          <span>
            · token {run.promptTokens ?? 0} giriş / {run.outputTokens ?? 0} çıkış
          </span>
        ) : null}
      </div>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <p>
          Teklif (kullanıcı girdisi):{" "}
          {run.offer ?? "yok — adaylarda teklif/indirim kullanılmadı"}
        </p>
        {run.instruction ? <p>Yönlendirme: {run.instruction}</p> : null}
      </div>

      {isActive ? (
        <p className="mt-3 rounded-md border border-border-soft bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Koşu bu sayfa açıkken ilerler (her aşama ayrı bir adımda kaydedilir).
          Sekmeyi kapatırsan koşu kaldığı aşamada bekler; tekrar açınca
          sürer.
        </p>
      ) : null}
      {run.status === "FAILED" && run.error ? (
        <div className="mt-3 rounded-md border border-destructive/40 p-3 text-sm">
          {run.error}
        </div>
      ) : null}
      {run.status === "CANCELLED" ? (
        <div className="mt-3 rounded-md border border-border-soft p-3 text-sm text-muted-foreground">
          Koşu iptal edildi; tamamlanan turlar aşağıda görünür.
        </div>
      ) : null}

      {summary && winner ? (
        <div className="mt-6 rounded-lg border border-accent/50 bg-panel p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium">Kazanan</h2>
            <ConfidenceBadge level={summary.confidence} />
            <span className="text-xs text-muted-foreground">
              {summary.rounds_run} tur ·{" "}
              {summary.convergence === "early"
                ? `erken yakınsama (${summary.convergenceReason === "same_winner" ? "aynı aday 2 tur üst üste 1." : "skor artışı < 2"})`
                : "tüm turlar koştu"}
            </span>
            {run.winnerCreativeId ? (
              <Link
                href={`/app/brands/${brand.id}/creatives`}
                className="ml-auto text-xs text-accent underline underline-offset-4"
              >
                Onay akışına gönderildi → Creative Studio
              </Link>
            ) : null}
          </div>
          <div className="mt-3 rounded-md border border-border-soft bg-muted/40 p-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {winner.primaryText}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border-soft pt-2 text-sm">
              <span className="font-medium">{winner.headline}</span>
              {winner.description ? (
                <span className="text-muted-foreground">· {winner.description}</span>
              ) : null}
              <span className="ml-auto rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                {winner.cta}
              </span>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            <div className="uppercase tracking-wide">Gerekçe (jüri eleştirilerinden)</div>
            <p className="mt-1 whitespace-pre-wrap">{summary.winnerRationale}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Veri temeli: araştırma {summary.dataBasis.research ? "var" : "yok"} ·
              pattern {summary.dataBasis.pattern ? "var" : "yok"} · öğrenme{" "}
              {summary.dataBasis.learnings}
            </span>
            <span>
              Tur başına en iyi toplam: {summary.bestTotalByRound.map((b) => b.toFixed(1)).join(" → ")}
            </span>
            <span>
              Aktarılan aday: {summary.promotedCandidateIds.length} (PENDING, onayın
              gerekir)
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{summary.disclaimer}</p>
        </div>
      ) : null}

      {run.rounds.map((round) => {
        const cands = run.candidates.filter((c) => c.roundId === round.id);
        const ordered = [...cands].sort((a, b) => {
          const ra = a.rank ?? Number.MAX_SAFE_INTEGER;
          const rb = b.rank ?? Number.MAX_SAFE_INTEGER;
          if (ra !== rb) return ra - rb;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
        const eliminatedCount = cands.filter((c) => c.eliminatedReason).length;
        return (
          <section
            key={round.id}
            className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-medium">
                  Tur {round.index + 1}
                </h2>
                <StageChips stage={round.stage} />
              </div>
              <div className="text-xs text-muted-foreground">
                {cands.length} aday · {eliminatedCount} elendi
                {round.generateAttempts > 1 ? ` · ${round.generateAttempts} üretim denemesi` : ""}
                {round.promptTokens || round.outputTokens
                  ? ` · token ${round.promptTokens ?? 0}/${round.outputTokens ?? 0}`
                  : ""}
              </div>
            </div>
            {cands.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {isActive ? "Adaylar üretiliyor..." : "Aday üretilmedi."}
              </p>
            ) : null}
            <div className="mt-4 space-y-3">
              {ordered.map((c) => (
                <CandidateCard
                  key={c.id}
                  c={c}
                  runId={run.id}
                  runCompleted={run.status === "COMPLETED"}
                  promotedIds={promotedIds}
                  brandId={brand.id}
                  labelById={labelById}
                />
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-6 text-xs text-muted-foreground">{ARENA_DISCLAIMER}</p>
    </div>
  );
}
