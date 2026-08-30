import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { loadLaunchState } from "@/components/launch/launch-state";
import { LaunchPoller } from "@/components/launch/launch-poller";
import { Stepper } from "@/components/launch/stepper";
import {
  ArenaStep,
  CompetitorsStep,
  ProfileStep,
  ResearchStep,
} from "@/components/launch/steps-setup";
import {
  ApprovalStep,
  KitStep,
  PlanStep,
  ResultsStep,
} from "@/components/launch/steps-launch";

export const metadata = { title: "Launch | AdScore" };
// Bu sayfadan çağrılan action'lar (araştırma, üretim, plan) arka planda AI
// koşturur; mevcut AI sayfalarıyla aynı limit.
export const maxDuration = 60;

export default async function LaunchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ id }, { step: stepParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  const user = await getCurrentUser();
  if (!user?.workspace) redirect("/login");

  const brand = await prisma.brand.findFirst({
    where: { id, workspaceId: user.workspace.id },
  });
  if (!brand) notFound();

  const state = await loadLaunchState(brand.id, user.workspace.id);
  if (!state) notFound();

  const wizardHref = `/app/brands/${brand.id}/launch`;

  // Görüntülenen adım URL'de sabitlenir (?step=n): form action'ları sayfayı
  // yeniden render ettiğinde kullanıcı aynı adımda kalır, "sonraki adım"
  // yalnız kendi düğmesiyle gelir. Parametre yoksa önerilen adıma yönlendirilir;
  // kilitli adım istenirse de önerilene düşülür — kapı bypass edilmez.
  const requested = Number.parseInt(stepParam ?? "", 10);
  const requestedStep =
    Number.isInteger(requested) && requested >= 1 && requested <= 8
      ? state.steps[requested - 1]
      : null;
  if (!requestedStep || requestedStep.status === "locked") {
    redirect(`${wizardHref}?step=${state.suggestedIndex}`);
  }
  const viewIndex = requestedStep.index;

  const stepProps = { state, brand, wizardHref };
  const panels = [
    <ProfileStep key="profile" {...stepProps} />,
    <ResearchStep key="research" {...stepProps} />,
    <CompetitorsStep key="competitors" {...stepProps} />,
    <ArenaStep key="arena" {...stepProps} />,
    <ApprovalStep key="approval" {...stepProps} />,
    <PlanStep key="plan" {...stepProps} />,
    <KitStep key="kit" {...stepProps} />,
    <ResultsStep key="results" {...stepProps} />,
  ];

  return (
    <div className="mx-auto w-full max-w-5xl">
      {state.running ? <LaunchPoller /> : null}
      <Link
        href={`/app/brands/${brand.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft size={14} />
        {brand.name}
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Launch</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Marka → Araştırma → Arena → Onay → Plan → Kit → Sonuç. Adım durumu
            kayıtlardan türetilir; hiçbir kapı atlanmaz, para harcanmaz.
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>
            Sıradaki:{" "}
            <span className="font-medium text-foreground">
              {state.nextAction}
            </span>
          </div>
          {state.running ? (
            <div className="mt-0.5 animate-pulse">Süren iş var — izleniyor</div>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <Stepper
          steps={state.steps}
          viewIndex={viewIndex}
          baseHref={wizardHref}
        />
      </div>

      {panels[viewIndex - 1]}
    </div>
  );
}
