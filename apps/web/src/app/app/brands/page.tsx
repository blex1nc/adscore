import Link from "next/link";
import { redirect } from "next/navigation";
import { CirclePlus } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { MARKETS } from "@/lib/options";

export const metadata = { title: "Markalar | AdScore" };

export default async function BrandsPage() {
  const user = await getCurrentUser();
  if (!user?.workspace) redirect("/login");

  const brands = await prisma.brand.findMany({
    where: { workspaceId: user.workspace.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Markalar</h1>
        <Link
          href="/app/brands/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-85"
        >
          <CirclePlus size={14} />
          Marka ekle
        </Link>
      </div>

      {brands.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Henüz marka yok. Her marka kendi araştırma, strateji ve kampanya
            alanına sahip olur.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Marka</th>
                <th className="px-4 py-3 font-medium">Website</th>
                <th className="px-4 py-3 font-medium">Hedef pazar</th>
                <th className="px-4 py-3 font-medium">Para birimi</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <tr
                  key={brand.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/brands/${brand.id}`}
                      className="font-medium hover:text-accent"
                    >
                      {brand.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {brand.website ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {MARKETS.find((m) => m.code === brand.targetMarket)
                      ?.label ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {brand.currency ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
