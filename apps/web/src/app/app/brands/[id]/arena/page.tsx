import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/components/ui";
import { StartArenaForm } from "@/components/evolution/arena-forms";
import { ArenaPoller } from "@/components/evolution/arena-poller";
import {
  ARENA_DISCLAIMER,
  GOAL_LABELS,
  RUN_STATUS_LABELS,
} from "@/lib/evolution/constants";
import { parseConfig, type EvolutionSummary } from "@/lib/evolution/run";

export const metadata = { title: "Arena | AdScore" };
export const maxDuration = 60;

export default async function ArenaPage({
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
      evolutionRuns: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { _count: { select: { candidates: true, rounds: true } } },
      },
      researchRuns: { where: { status: "COMPLETED" }, take: 1 },
    },
  });
  if (!brand) notFound();

  const active = brand.evolutionRuns.find(
    (r) => r.status === "QUEUED" || r.status === "RUNNING",
  );

  return (
    <div className="mx-auto max-w-4xl">
      {active ? <ArenaPoller runId={active.id} /> : null}
      <Link
        href={`/app/brands/${brand.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft size={14} />
        {brand.name}
      </Link>
      <h1 className="mt-3 font-display text-3xl">Arena</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Creative Evolution Engine: copy adayları birçok tur boyunca
        deterministik kurallar ve AI jüri paneliyle yarışır; zayıf elenir,
        güçlü çoğalır. Kazanan ve en iyi adaylar onayına sunulur — yayın her
        zaman senin onayınla olur.
      </p>
      <p className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {ARENA_DISCLAIMER}
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-medium">Yeni koşu</h2>
        <StartArenaForm
          brandId={brand.id}
          hasActive={!!active}
          hasResearch={brand.researchRuns.length > 0}
        />
        {active ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Süren koşu:{" "}
            <Link
              href={`/app/brands/${brand.id}/arena/${active.id}`}
              className="underline underline-offset-4"
            >
              tur {active.currentRound + 1} / {active.maxRounds} →
            </Link>
          </p>
        ) : null}
      </div>

      <h2 className="mt-8 text-sm font-medium">Geçmiş koşular</h2>
      {brand.evolutionRuns.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Henüz koşu yok.</p>
        </div>
      ) : null}
      <div className="mt-3 space-y-3">
        {brand.evolutionRuns.map((run) => {
          const cfg = parseConfig(run.config);
          const summary = run.summary as EvolutionSummary | null;
          return (
            <Link
              key={run.id}
              href={`/app/brands/${brand.id}/arena/${run.id}`}
              className="block rounded-2xl border border-border bg-card p-5 transition-colors duration-300 hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 uppercase tracking-wide",
                    run.status === "COMPLETED" && "border-accent/40 text-accent",
                    run.status === "FAILED" && "border-destructive/40 text-destructive",
                    run.status === "CANCELLED" && "border-border",
                    (run.status === "RUNNING" || run.status === "QUEUED") &&
                      "border-border text-foreground",
                  )}
                >
                  {RUN_STATUS_LABELS[run.status]}
                </span>
                <span>{GOAL_LABELS[run.goal] ?? run.goal}</span>
                <span>
                  · {cfg.rounds} tur × {cfg.population} aday × {cfg.judges} jüri
                </span>
                <span>· {run._count.candidates} aday</span>
                {summary ? (
                  <span>
                    · {summary.rounds_run} tur koştu
                    {summary.convergence === "early" ? " (erken yakınsama)" : ""}
                  </span>
                ) : null}
                <span className="ml-auto">
                  {run.createdAt.toLocaleString("tr-TR")}
                </span>
              </div>
              {run.offer ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Teklif (kullanıcı girdisi): {run.offer}
                </p>
              ) : null}
              {run.status === "FAILED" && run.error ? (
                <p className="mt-2 text-xs text-destructive">{run.error}</p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
