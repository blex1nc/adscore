import Link from "next/link";
import { redirect } from "next/navigation";
import { CirclePlus, Tags } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { MARKETS } from "@/lib/options";
import { Card, EmptyState, PageHeader } from "@/components/panel/kit";

export const metadata = { title: "Markalar | AdScore" };

export default async function BrandsPage() {
  const user = await getCurrentUser();
  if (!user?.workspace) redirect("/login");

  // Sayılar gerçek kayıtlardan gelir; tahmin veya örnek veri yok (CLAUDE.md §6, §31).
  const brands = await prisma.brand.findMany({
    where: { workspaceId: user.workspace.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { competitors: true, creatives: true, campaignPlans: true },
      },
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader
        icon={<Tags size={16} />}
        title="Markalar"
        description="Her marka kendi araştırma, rakip, creative ve kampanya alanına sahiptir."
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

      {brands.length === 0 ? (
        <Card>
          <EmptyState
            title="Henüz marka yok"
            description="Her marka kendi araştırma, strateji ve kampanya alanına sahip olur."
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
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-soft bg-panel-2 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Marka</th>
                  <th className="px-4 py-2.5 font-medium">Website</th>
                  <th className="px-4 py-2.5 font-medium">Hedef pazar</th>
                  <th className="px-4 py-2.5 text-right font-medium">Rakip</th>
                  <th className="px-4 py-2.5 text-right font-medium">Creative</th>
                  <th className="px-4 py-2.5 text-right font-medium">Plan</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {brands.map((brand) => (
                  <tr
                    key={brand.id}
                    className="border-b border-border-soft transition-colors duration-300 last:border-0 hover:bg-panel-2"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/brands/${brand.id}`}
                        className="font-medium hover:text-accent"
                      >
                        {brand.name}
                      </Link>
                      {brand.currency ? (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {brand.currency}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {brand.website ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {MARKETS.find((m) => m.code === brand.targetMarket)?.label ??
                        "-"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {brand._count.competitors}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {brand._count.creatives}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {brand._count.campaignPlans}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/app/brands/${brand.id}/launch`}
                        className="text-xs text-accent hover:opacity-80"
                      >
                        Launch →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
