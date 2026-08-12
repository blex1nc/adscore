import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { deleteBrand, updateBrand } from "@/actions/brands";
import { BrandForm } from "@/components/brand-form";
import { ResearchSection } from "@/components/research/research-section";
import { DeleteBrandButton } from "./delete-brand-button";

export const metadata = { title: "Marka | AdScore" };

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
  });
  if (!brand) notFound();

  const updateAction = updateBrand.bind(null, brand.id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/app/brands"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Markalar
      </Link>
      <h1 className="mt-3 font-display text-3xl">{brand.name}</h1>
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <BrandForm
          action={updateAction}
          initial={brand}
          submitLabel="Kaydet"
          successMessage="Kaydedildi."
        />
      </div>
      <ResearchSection brandId={brand.id} />

      <div className="mt-6 rounded-2xl border border-destructive/30 p-6">
        <h2 className="text-sm font-medium">Markayı sil</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Marka ve ileride ona bağlı araştırma verileri silinir. Bu işlem geri
          alınamaz.
        </p>
        <form action={deleteBrand} className="mt-4">
          <input type="hidden" name="brandId" value={brand.id} />
          <DeleteBrandButton />
        </form>
      </div>
    </div>
  );
}
