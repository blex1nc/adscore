import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import {
  approveCreative,
  rejectCreative,
  resetCreativeApproval,
} from "@/actions/creatives";
import { cn } from "@/components/ui";
import { ConfidenceBadge } from "@/components/competitors/ad-analysis-view";
import {
  EditCreativeForm,
  GenerateForm,
} from "@/components/creatives/creative-forms";
import { GenerateImageButton } from "@/components/creatives/image-button";
import { ResearchPoller } from "@/components/research/research-poller";

export const metadata = { title: "Creative Studio | AdScore" };
export const maxDuration = 60;

const APPROVAL_LABELS: Record<string, string> = {
  PENDING: "Onay bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
};

export default async function CreativesPage({
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
      creatives: {
        orderBy: { createdAt: "desc" },
        include: {
          generation: { select: { offer: true, model: true } },
          images: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      creativeGenerations: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!brand) notFound();

  const latestGeneration = brand.creativeGenerations[0];
  const hasActive =
    latestGeneration?.status === "QUEUED" ||
    latestGeneration?.status === "RUNNING" ||
    brand.creatives.some((c) =>
      c.images.some(
        (img) => img.status === "QUEUED" || img.status === "RUNNING",
      ),
    );

  return (
    <div className="mx-auto max-w-4xl">
      {hasActive ? <ResearchPoller /> : null}
      <Link
        href={`/app/brands/${brand.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft size={14} />
        {brand.name}
      </Link>
      <h1 className="mt-3 font-display text-3xl">Creative Studio</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Copy varyantları marka araştırması ve pattern analizinden beslenir.
        Onaylanmayan hiçbir creative kampanyada kullanılmaz; yayın her zaman
        senin onayınla olur.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-medium">Yeni üretim</h2>
        <GenerateForm brandId={brand.id} hasActive={hasActive} />
        {latestGeneration?.status === "FAILED" && latestGeneration.error ? (
          <div className="mt-4 rounded-md border border-destructive/40 p-3 text-sm">
            {latestGeneration.error}
          </div>
        ) : null}
      </div>

      {brand.creatives.length === 0 && !hasActive ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Henüz creative üretilmedi.
          </p>
        </div>
      ) : null}

      {brand.creatives.map((creative, index) => (
        <div
          key={creative.id}
          className="mt-6 rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono text-[11px] tracking-[0.15em]">
                {String(brand.creatives.length - index).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 uppercase tracking-wide",
                  creative.approval === "APPROVED" &&
                    "border-accent/40 text-accent",
                  creative.approval === "REJECTED" &&
                    "border-destructive/40 text-destructive",
                  creative.approval === "PENDING" && "border-border",
                )}
              >
                {APPROVAL_LABELS[creative.approval]}
              </span>
              {creative.editedAt ? <span>düzenlendi</span> : null}
              <ConfidenceBadge level={creative.confidence} />
            </div>
            <div className="flex items-center gap-2">
              {creative.approval !== "APPROVED" ? (
                <form action={approveCreative}>
                  <input
                    type="hidden"
                    name="creativeId"
                    value={creative.id}
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-85"
                  >
                    Onayla
                  </button>
                </form>
              ) : null}
              {creative.approval !== "REJECTED" ? (
                <form action={rejectCreative}>
                  <input
                    type="hidden"
                    name="creativeId"
                    value={creative.id}
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-border px-3.5 py-1.5 text-xs text-muted-foreground transition-colors duration-300 hover:text-destructive"
                  >
                    Reddet
                  </button>
                </form>
              ) : null}
              {creative.approval !== "PENDING" ? (
                <form action={resetCreativeApproval}>
                  <input
                    type="hidden"
                    name="creativeId"
                    value={creative.id}
                  />
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

          <div className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Strateji
              </div>
              <p className="mt-0.5">{creative.strategy}</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Hook
              </div>
              <p className="mt-0.5">{creative.hook}</p>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-border bg-muted/40 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {creative.primaryText}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm">
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

          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {creative.targetNote ? <p>Hedef: {creative.targetNote}</p> : null}
            <p>Neden: {creative.why}</p>
            {creative.generation.offer ? (
              <p>Teklif (kullanıcı girdisi): {creative.generation.offer}</p>
            ) : null}
          </div>

          <div className="mt-4 border-t border-border pt-3">
            {creative.images[0]?.status === "COMPLETED" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/creative-images/${creative.images[0].id}`}
                alt={`${creative.headline} için üretilen reklam görseli`}
                className="mb-3 w-full max-w-sm rounded-xl border border-border"
              />
            ) : null}
            {creative.images[0]?.status === "FAILED" &&
            creative.images[0].error ? (
              <div className="mb-3 rounded-md border border-destructive/40 p-2 text-xs">
                Görsel üretilemedi: {creative.images[0].error}
              </div>
            ) : null}
            <GenerateImageButton
              creativeId={creative.id}
              hasActive={
                creative.images[0]?.status === "QUEUED" ||
                creative.images[0]?.status === "RUNNING"
              }
            />
          </div>

          <details className="mt-4">
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
      ))}
    </div>
  );
}
