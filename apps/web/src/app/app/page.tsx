import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CirclePlus, Plug, Rocket } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { loadLaunchStates } from "@/components/launch/launch-state";
import { LaunchPoller } from "@/components/launch/launch-poller";
import { cn } from "@/components/ui";

export const metadata = { title: "Ana sayfa | AdScore" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user?.workspace) redirect("/login");

  // Marka başına launch durumu — DB'den türetilir, sahte metrik yok
  const states = await loadLaunchStates(user.workspace.id);
  const firstName = user.name.split(" ")[0];
  const anyRunning = states.some((s) => s.running);

  // Yalnızca gerçek kayıt sayıları
  const totals = states.reduce(
    (acc, s) => ({
      approved: acc.approved + s.summary.creatives.approved,
      results: acc.results + s.summary.plan.resultCount,
    }),
    { approved: 0, results: 0 },
  );

  return (
    <div className="mx-auto max-w-4xl">
      {anyRunning ? <LaunchPoller intervalMs={5000} /> : null}
      <h1 className="font-display text-3xl">Hoş geldin, {firstName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Her marka tek akışta ilerler: Marka → Araştırma → Arena → Onay → Plan
        → Kit → Sonuç.
      </p>

      {states.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Rocket size={15} className="text-muted-foreground" />
            Launch
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Henüz marka eklenmedi. Araştırma, Arena ve kampanya her markanın
            kendi çalışma alanında yürür.
          </p>
          <Link
            href="/app/brands/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-85"
          >
            <CirclePlus size={14} />
            İlk markanı ekle
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Rocket size={15} className="text-muted-foreground" />
              Launch durumu
            </h2>
            <Link
              href="/app/brands/new"
              className="inline-flex items-center gap-1.5 text-xs text-accent hover:opacity-80"
            >
              <CirclePlus size={13} />
              Marka ekle
            </Link>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {states.map((state) => {
              const s = state.summary;
              const doneCount = state.steps.filter(
                (st) => st.status === "done",
              ).length;
              const activeStep = state.steps[state.activeIndex - 1];
              return (
                <div
                  key={s.brandId}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/app/brands/${s.brandId}`}
                        className="block truncate text-sm font-medium hover:text-accent"
                      >
                        {s.brandName}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {state.allDone
                          ? "Akış tamamlandı"
                          : `Adım ${state.activeIndex}/8 · ${activeStep.title}`}
                      </p>
                    </div>
                    {state.running ? (
                      <span className="shrink-0 animate-pulse rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Sürüyor
                      </span>
                    ) : null}
                  </div>

                  <ol
                    className="mt-4 grid grid-cols-8 gap-1"
                    aria-label={`${doneCount} / 8 adım tamam`}
                  >
                    {state.steps.map((st) => (
                      <li
                        key={st.key}
                        title={`${st.index}. ${st.title}`}
                        className={cn(
                          "h-1.5 rounded-full",
                          st.status === "done" && "bg-accent",
                          st.status === "active" && "bg-accent/40",
                          st.status === "skipped" && "bg-border",
                          (st.status === "available" ||
                            st.status === "locked") &&
                            "bg-muted",
                          st.running && "animate-pulse",
                        )}
                      />
                    ))}
                  </ol>

                  <p className="mt-3 text-sm">{state.nextAction}</p>

                  <div className="mt-4 flex items-center gap-3">
                    <Link
                      href={`/app/brands/${s.brandId}/launch`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-85"
                    >
                      {doneCount === 0 ? "Başlat" : "Devam et"}
                      <ArrowRight size={13} />
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {s.creatives.approved} onaylı creative ·{" "}
                      {s.plan.resultCount} sonuç
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-medium">Kayıtlar</div>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
            {(
              [
                ["Marka", states.length],
                ["Onaylı creative", totals.approved],
                ["Girilen sonuç", totals.results],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {k}
                </dt>
                <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Yalnızca gerçek kayıt sayıları; performans tahmini veya örnek veri
            gösterilmez.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Plug size={15} className="text-muted-foreground" />
            Meta bağlantısı
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Bağlı değil (ertelendi). Kampanyayı kurulum kitiyle Ads Manager&apos;da
            sen kurarsın; sonuçları CSV veya elle girersin. Resmi OAuth
            bağlantısı ileride panelden eklenecek.
          </p>
        </div>
      </div>
    </div>
  );
}
