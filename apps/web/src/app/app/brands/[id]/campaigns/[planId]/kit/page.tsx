import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { readChecklist, readKit } from "@/lib/publish-kit/access";
import { KitView } from "@/components/campaigns/kit-view";
import { BuildKitButton } from "@/components/campaigns/kit-forms";

export const metadata = { title: "Ads Manager kurulum kiti | AdScore" };

export default async function KitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; planId: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id, planId } = await params;
  const { v } = await searchParams;
  const user = await getCurrentUser();
  if (!user?.workspace) redirect("/login");

  const plan = await prisma.campaignPlan.findFirst({
    where: { id: planId, brandId: id, brand: { workspaceId: user.workspace.id } },
    include: {
      brand: { select: { id: true, name: true } },
      kits: { orderBy: { version: "desc" } },
      creatives: { where: { approval: "APPROVED" }, select: { id: true } },
    },
  });
  if (!plan) notFound();

  const requested = v ? Number(v) : NaN;
  const current =
    plan.kits.find((k) => k.version === requested) ?? plan.kits[0] ?? null;
  const kit = current ? readKit(current.kit) : null;
  const approvedCount = plan.creatives.length;
  const canBuild = plan.status === "COMPLETED" && approvedCount > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/app/brands/${plan.brand.id}/campaigns`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft size={14} />
        {plan.brand.name} · Kampanya kiti
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Ads Manager kurulum kiti</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Ads Manager ekran sırasında (Kampanya → Reklam seti → Reklam), her
            alan kopyalanabilir. Planda olmayan değer uydurulmaz; senin
            belirleyeceklerin ayrıca listelenir. Bütçe ve yayın kararı tamamen
            sende.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {plan.kits.length > 1 ? (
            <form className="text-xs text-muted-foreground">
              <label htmlFor="kit-version" className="mr-1.5">
                Sürüm
              </label>
              <select
                id="kit-version"
                name="v"
                defaultValue={String(current?.version ?? "")}
                className="rounded-md border border-border-soft bg-panel px-2 py-1 text-xs"
              >
                {plan.kits.map((k) => (
                  <option key={k.id} value={k.version}>
                    v{k.version} · {k.createdAt.toLocaleDateString("tr-TR")}
                  </option>
                ))}
              </select>
              <button type="submit" className="ml-1.5 text-accent">
                Git
              </button>
            </form>
          ) : null}
          <BuildKitButton
            planId={plan.id}
            disabled={!canBuild}
            hasKit={Boolean(kit)}
            reason={
              plan.status !== "COMPLETED"
                ? "Plan tamamlanmadan kit üretilmez."
                : approvedCount === 0
                  ? "Kit için onaylı creative gerekli."
                  : undefined
            }
          />
        </div>
      </div>

      {!kit || !current ? (
        <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6 text-sm text-muted-foreground">
          {canBuild
            ? "Bu plan için henüz kit üretilmedi. Sağ üstten üret; kit yalnız onaylı creative'lerden ve planın kendi verisinden kurulur."
            : plan.status !== "COMPLETED"
              ? "Plan henüz tamamlanmadı; tamamlanınca kit üretilebilir."
              : "Planda onaylı creative yok. Creative Studio'da en az bir varyantı onayla."}
        </div>
      ) : (
        <KitView
          kit={kit}
          kitId={current.id}
          version={current.version}
          brandId={plan.brand.id}
          planId={plan.id}
          checklist={readChecklist(current.checklist)}
          publishedAt={plan.publishedAt?.toISOString() ?? null}
          publishNote={plan.publishNote}
        />
      )}
    </div>
  );
}
