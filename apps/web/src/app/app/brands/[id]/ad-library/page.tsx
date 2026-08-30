// C3 — Ad Library modülü. Marka kapsamlı: Meta istemcisi workspace,
// içe aktarma hedefi ise markanın rakipleri olduğu için global rota değil.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { AdLibraryBrowser } from "@/components/library/ad-library-browser";

export const metadata = { title: "Ad Library | AdScore" };
export const maxDuration = 60;

export default async function AdLibraryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user?.workspace) redirect("/login");

  const brand = await prisma.brand.findFirst({
    where: { id, workspaceId: user.workspace.id },
    select: {
      id: true,
      name: true,
      targetMarket: true,
      competitors: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      },
    },
  });
  if (!brand) notFound();

  const connection = await prisma.metaConnection.findUnique({
    where: { workspaceId: user.workspace.id },
    select: { status: true },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={`/app/brands/${brand.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={13} />
        {brand.name}
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Ad Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Meta Ad Library&apos;de reklam ara, gez, işine yarayanları rakip
            reklamı olarak içe aktar. Gezinme hiçbir şey kaydetmez.
          </p>
        </div>
        <Link
          href={`/app/brands/${brand.id}/competitors`}
          className="inline-flex items-center gap-1.5 text-xs text-accent hover:opacity-80"
        >
          <Users size={13} />
          Rakipler ({brand.competitors.length})
        </Link>
      </div>

      <div className="mt-6">
        {connection?.status === "CONNECTED" ? (
          <AdLibraryBrowser
            brandId={brand.id}
            brandName={brand.name}
            targetMarket={brand.targetMarket}
            competitors={brand.competitors}
          />
        ) : (
          <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm">
            <span className="mr-2 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide">
              BLOCKED
            </span>
            Ad Library sorgusu Meta bağlantısı gerektirir.{" "}
            <Link href="/app/settings/meta" className="text-accent hover:opacity-80">
              Meta hesabını bağla
            </Link>
            . Bağlantı olmadan rakip reklamlarını{" "}
            <Link
              href={`/app/brands/${brand.id}/competitors`}
              className="text-accent hover:opacity-80"
            >
              Rakipler
            </Link>{" "}
            ekranından metin yapıştırarak ekleyebilirsin — mock veri gösterilmez.
          </div>
        )}
      </div>
    </div>
  );
}
