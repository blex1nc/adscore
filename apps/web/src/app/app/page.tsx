import Link from "next/link";
import { redirect } from "next/navigation";
import { CirclePlus, Plug, Tags } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Ana sayfa | AdScore" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user?.workspace) redirect("/login");

  const brandCount = await prisma.brand.count({
    where: { workspaceId: user.workspace.id },
  });
  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl">Hoş geldin, {firstName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        AdScore erken erişim. Modüller faz faz açılıyor.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Tags size={15} className="text-muted-foreground" />
            Markalar
          </div>
          {brandCount === 0 ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                Henüz marka eklenmedi. Araştırma ve strateji her markanın kendi
                çalışma alanında yürür.
              </p>
              <Link
                href="/app/brands/new"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-85"
              >
                <CirclePlus size={14} />
                İlk markanı ekle
              </Link>
            </>
          ) : (
            <>
              <p className="mt-3 text-3xl font-semibold">{brandCount}</p>
              <Link
                href="/app/brands"
                className="mt-3 inline-block text-sm text-accent hover:opacity-80"
              >
                Markaları görüntüle
              </Link>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Plug size={15} className="text-muted-foreground" />
            Meta bağlantısı
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Bağlı değil. Meta Business hesabın panel üzerinden, resmi OAuth
            akışıyla bağlanacak. Bu özellik Phase 5 ile geliyor.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:col-span-2">
          <div className="text-sm font-medium">Performans</div>
          <p className="mt-3 text-sm text-muted-foreground">
            Veri yok. Metrikler, Meta hesabın bağlanıp kampanyaların
            çalışmasından sonra burada görünecek. AdScore tahmini veya örnek
            veri göstermez; veri yetersizse bunu açıkça söyler.
          </p>
        </div>
      </div>
    </div>
  );
}
