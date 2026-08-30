import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Rocket } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { deleteBrand, updateBrand } from "@/actions/brands";
import { BrandForm } from "@/components/brand-form";
import { ResearchSection } from "@/components/research/research-section";
import { BrandProfileSection } from "@/components/launch/brand-profile-section";
import { PreviewTabs } from "@/components/preview/preview-tabs";
import { cn } from "@/components/ui";
import { DeleteBrandButton } from "./delete-brand-button";

export const metadata = { title: "Marka | AdScore" };
// Bu sayfanın server action'ları (araştırma) arka planda AI çağrısı koşturur
export const maxDuration = 60;

const PLAN_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Sırada",
  RUNNING: "Hazırlanıyor",
  COMPLETED: "Hazır",
  FAILED: "Başarısız",
};

const navLink =
  "rounded-full border border-border-soft bg-panel px-4 py-2 text-xs font-medium transition-colors duration-300 hover:bg-muted";

export default async function BrandDetailPage({
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
      campaignPlans: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          status: true,
          goal: true,
          budgetAmount: true,
          currency: true,
          budgetType: true,
          createdAt: true,
          _count: { select: { creatives: true, results: true } },
        },
      },
      assets: {
        where: { kind: "LOGO" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
      creatives: {
        where: { approval: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          images: {
            where: { status: "COMPLETED" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });
  if (!brand) notFound();

  const updateAction = updateBrand.bind(null, brand.id);
  const lastApproved = brand.creatives[0] ?? null;
  const logoUrl = brand.assets[0] ? `/api/brand-assets/${brand.assets[0].id}` : null;
  const base = `/app/brands/${brand.id}`;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/app/brands"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Markalar
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{brand.name}</h1>
        <Link
          href={`${base}/launch`}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-85"
        >
          <Rocket size={13} />
          Launch
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={`${base}/competitors`} className={navLink}>
          Rakipler →
        </Link>
        <Link href={`${base}/ad-library`} className={navLink}>
          Ad Library →
        </Link>
        <Link href={`${base}/arena`} className={navLink}>
          Arena →
        </Link>
        <Link href={`${base}/creatives`} className={navLink}>
          Creative Studio →
        </Link>
        <Link href={`${base}/campaigns`} className={navLink}>
          Kampanya kiti →
        </Link>
        <Link href={`${base}/optimization`} className={navLink}>
          Optimizasyon →
        </Link>
        <Link href="/app/settings/meta" className={navLink}>
          Meta bağlantısı →
        </Link>
      </div>

      <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6">
        <BrandForm
          action={updateAction}
          initial={brand}
          submitLabel="Kaydet"
          successMessage="Kaydedildi."
        />
      </div>
      <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6">
        <BrandProfileSection brandId={brand.id} />
      </div>
      <ResearchSection brandId={brand.id} />

      {lastApproved ? (
        <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6">
          <h2 className="text-sm font-medium">Son onaylı creative</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {lastApproved.strategy} · onaylandığı haliyle nötr çerçevelerde
            önizleme.
          </p>
          <div className="mt-4">
            <PreviewTabs
              compact
              creative={{
                primaryText: lastApproved.primaryText,
                headline: lastApproved.headline,
                description: lastApproved.description,
                cta: lastApproved.cta,
              }}
              imageUrl={
                lastApproved.images[0]
                  ? `/api/creative-images/${lastApproved.images[0].id}`
                  : null
              }
              brand={{ name: brand.name, logoUrl }}
            />
          </div>
        </div>
      ) : null}

      {brand.campaignPlans.length ? (
        <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6">
          <h2 className="text-sm font-medium">Kampanya planları</h2>
          <ul className="mt-3 divide-y divide-border">
            {brand.campaignPlans.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
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
                    {PLAN_STATUS_LABELS[plan.status]}
                  </span>
                  <span>
                    {plan.createdAt.toLocaleDateString("tr-TR")} · {plan.goal} ·{" "}
                    {plan.budgetAmount.toString()} {plan.currency} (
                    {plan.budgetType === "DAILY" ? "günlük" : "toplam"}) ·{" "}
                    {plan._count.creatives} creative · {plan._count.results}{" "}
                    sonuç
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {plan.status === "COMPLETED" ? (
                    <Link
                      href={`${base}/campaigns/${plan.id}/kit`}
                      className="text-accent hover:opacity-80"
                    >
                      Kurulum kiti →
                    </Link>
                  ) : null}
                  <Link
                    href={`${base}/campaigns`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Plan →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 rounded-lg border border-destructive/30 p-6">
        <h2 className="text-sm font-medium">Markayı sil</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Marka ve ona bağlı araştırma, creative, plan ve sonuç verileri
          silinir. Bu işlem geri alınamaz.
        </p>
        <form action={deleteBrand} className="mt-4">
          <input type="hidden" name="brandId" value={brand.id} />
          <DeleteBrandButton />
        </form>
      </div>
    </div>
  );
}
