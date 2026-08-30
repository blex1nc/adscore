import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CirclePlus,
  LayoutDashboard,
  Plug,
  Rocket,
} from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { loadLaunchStates } from "@/components/launch/launch-state";
import { LaunchPoller } from "@/components/launch/launch-poller";
import {
  Card,
  CardHeader,
  Chip,
  EmptyState,
  PageHeader,
  StatTile,
} from "@/components/panel/kit";
import { BarChart, type BarPoint } from "@/components/panel/bar-chart";
import { cn } from "@/components/ui";

export const metadata = { title: "Ana sayfa | AdScore" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user?.workspace) redirect("/login");

  // Marka başına launch durumu — DB'den türetilir, sahte metrik yok
  const states = await loadLaunchStates(user.workspace.id);
  const firstName = user.name.split(" ")[0];
  const anyRunning = states.some((s) => s.running);

  // Yalnızca gerçek kayıt sayıları — tahmin/örnek veri yok (CLAUDE.md §6, §31)
  const totals = states.reduce(
    (acc, s) => ({
      approved: acc.approved + s.summary.creatives.approved,
      pendingCreatives: acc.pendingCreatives + s.summary.creatives.pending,
      results: acc.results + s.summary.plan.resultCount,
      competitors: acc.competitors + s.summary.competitors.count,
      analyzedAds: acc.analyzedAds + s.summary.competitors.analyzedAds,
    }),
    { approved: 0, pendingCreatives: 0, results: 0, competitors: 0, analyzedAds: 0 },
  );

  const [connection, openRecommendations, results] = await Promise.all([
    // Gerçek Meta bağlantı durumu — sabit metin değil (bayat metin riski)
    prisma.metaConnection.findUnique({
      where: { workspaceId: user.workspace.id },
      select: { status: true, lastCheckedAt: true, errorNote: true },
    }),
    prisma.recommendation.count({
      where: {
        status: "PROPOSED",
        run: { brand: { workspaceId: user.workspace.id } },
      },
    }),
    // Grafik YALNIZ girilmiş gerçek sonuçlardan çizilir (CLAUDE.md §6, §28).
    prisma.campaignResult.findMany({
      where: { plan: { brand: { workspaceId: user.workspace.id } } },
      select: {
        periodStart: true,
        periodEnd: true,
        impressions: true,
        clicks: true,
        source: true,
        plan: { select: { brand: { select: { name: true } } } },
      },
      orderBy: { periodStart: "asc" },
      take: 30,
    }),
  ]);

  const boundBrands = connection
    ? await prisma.brandMetaBinding.count({
        where: { brand: { workspaceId: user.workspace.id } },
      })
    : 0;

  const metaStatus = metaStatusCopy(connection?.status ?? null, boundBrands);

  const fmt = new Intl.NumberFormat("tr-TR");
  const day = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit" });
  // Para birimleri markadan markaya değişebildiği için harcama TOPLANMAZ;
  // birimsiz ve toplanabilir olan gösterim çizilir (§6 — uydurma normalizasyon yok).
  const points: BarPoint[] = results.map((r) => ({
    label: day.format(r.periodStart),
    value: r.impressions,
    hint: `${r.plan.brand.name} · ${fmt.format(r.impressions)} gösterim · ${fmt.format(r.clicks)} tıklama`,
  }));

  // Kullanıcının karar vermesi gereken açık işler
  const pending: Array<{ label: string; href: string }> = [];
  for (const s of states) {
    if (s.summary.creatives.pending > 0) {
      pending.push({
        label: `${s.summary.brandName}: ${s.summary.creatives.pending} creative onay bekliyor`,
        href: `/app/brands/${s.summary.brandId}/creatives`,
      });
    }
  }
  if (openRecommendations > 0) {
    pending.push({
      label: `${openRecommendations} optimizasyon önerisi karar bekliyor`,
      href:
        states.length === 1
          ? `/app/brands/${states[0].summary.brandId}/optimization`
          : "/app/brands",
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      {anyRunning ? <LaunchPoller intervalMs={5000} /> : null}

      <PageHeader
        icon={<LayoutDashboard size={16} />}
        title={`Hoş geldin, ${firstName}`}
        description="Her marka tek akışta ilerler: Marka → Araştırma → Arena → Onay → Plan → Kit → Sonuç."
        actions={
          <Link
            href="/app/brands/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-85"
          >
            <CirclePlus size={14} />
            Marka ekle
          </Link>
        }
      />

      {/* Sonuç grafiği — veri yoksa çizilmez, dürüst boş durum gösterilir */}
      <Card>
        <CardHeader
          title="Girilen sonuçlar"
          note={
            points.length > 0
              ? `${points.length} dönem · gösterim sayısı. Para birimleri markalar arasında değişebildiği için harcama toplanmaz.`
              : undefined
          }
          actions={
            points.length > 0 ? (
              <Chip tone="accent">Gerçek kayıt</Chip>
            ) : null
          }
        />
        {points.length > 0 ? (
          <BarChart points={points} valueFormat={(v) => fmt.format(Math.round(v))} />
        ) : (
          <EmptyState
            title="Henüz sonuç girilmedi"
            description="Grafik yalnızca girilmiş gerçek kampanya sonuçlarından çizilir. Ads Manager raporunu CSV olarak içe aktarabilir veya sonucu elle girebilirsin; örnek veri gösterilmez."
          />
        )}
      </Card>

      {states.length === 0 ? (
        <Card>
          <CardHeader title="Launch" icon={<Rocket size={15} />} />
          <EmptyState
            title="Henüz marka eklenmedi"
            description="Araştırma, Arena ve kampanya her markanın kendi çalışma alanında yürür."
            action={
              <Link
                href="/app/brands/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-85"
              >
                <CirclePlus size={14} />
                İlk markanı ekle
              </Link>
            }
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Launch durumu"
            icon={<Rocket size={15} />}
            note={`${states.length} marka`}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {states.map((state) => {
              const s = state.summary;
              const doneCount = state.steps.filter(
                (st) => st.status === "done",
              ).length;
              const activeStep = state.steps[state.activeIndex - 1];
              return (
                <div
                  key={s.brandId}
                  className="rounded-lg border border-border-soft bg-panel-2 p-4"
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
                      <span className="shrink-0 animate-pulse rounded-full border border-border-soft px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
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
                          st.status === "skipped" && "bg-border-soft",
                          (st.status === "available" ||
                            st.status === "locked") &&
                            "bg-muted",
                          st.running && "animate-pulse",
                        )}
                      />
                    ))}
                  </ol>

                  <p className="mt-3 text-sm">{state.nextAction}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
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
        </Card>
      )}

      {pending.length > 0 ? (
        <Card>
          <CardHeader
            title="Senin kararını bekleyenler"
            note="AI hiçbir öneriyi kendi başına uygulamaz; onay senindir."
            actions={<Chip tone="accent">{pending.length}</Chip>}
          />
          <ul className="space-y-1.5">
            {pending.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1.5 text-sm text-accent hover:opacity-80"
                >
                  {item.label}
                  <ArrowRight size={13} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Kayıtlar"
            note="Yalnızca gerçek kayıt sayıları; performans tahmini veya örnek veri gösterilmez."
          />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {(
              [
                ["Marka", states.length],
                ["Rakip", totals.competitors],
                ["Analizli reklam", totals.analyzedAds],
                ["Onaylı creative", totals.approved],
                ["Onay bekleyen", totals.pendingCreatives],
                ["Girilen sonuç", totals.results],
              ] as const
            ).map(([k, v]) => (
              <StatTile key={k} label={k} value={v} />
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Meta bağlantısı"
            icon={<Plug size={15} />}
            actions={
              <Chip tone={metaStatus.tone === "ok" ? "positive" : "default"}>
                {metaStatus.label}
              </Chip>
            }
          />
          <p className="text-sm text-muted-foreground">{metaStatus.detail}</p>
          {connection?.errorNote ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Son hata: {connection.errorNote}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <Link href="/app/settings/meta" className="text-accent hover:opacity-80">
              Bağlantı ayarları →
            </Link>
            <Link
              href="/app/settings/meta-usage"
              className="text-accent hover:opacity-80"
            >
              API kullanımı →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Bağlantı durumu metinleri — durum DB'den gelir, sabit "bağlı değil" yazılmaz.
function metaStatusCopy(
  status: string | null,
  boundBrands: number,
): { label: string; tone: "ok" | "warn"; detail: string } {
  if (status === "CONNECTED") {
    return {
      label: "Bağlı",
      tone: "ok",
      detail:
        boundBrands > 0
          ? `${boundBrands} marka bir reklam hesabına bağlı. Insights çekimi ve Ad Library araması kullanılabilir; yayınlama her zaman senin onayınla ve PAUSED olarak yapılır.`
          : "Hesap bağlı ama hiçbir marka bir reklam hesabına eşlenmedi. Insights ve yayınlama için markayı bir Ad Account'a bağla.",
    };
  }
  if (status === "EXPIRED" || status === "REVOKED" || status === "DISCONNECTED") {
    return {
      label:
        status === "EXPIRED"
          ? "Süresi doldu"
          : status === "REVOKED"
            ? "İzin kaldırıldı"
            : "Kesildi",
      tone: "warn",
      detail:
        "Meta bağlantısı artık geçerli değil. Insights, Ad Library ve yayınlama bu bağlantı yenilenene kadar çalışmaz.",
    };
  }
  return {
    label: "Bağlı değil",
    tone: "warn",
    detail:
      "Meta hesabı bağlanmadı. Bağlantı olmadan Ad Library araması ve Insights çekimi yapılamaz; kampanyayı kurulum kitiyle Ads Manager'da kurar, sonuçları CSV veya elle girersin. Mock veri gösterilmez.",
  };
}
