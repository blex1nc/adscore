import { createBrand } from "@/actions/brands";
import { BrandForm } from "@/components/brand-form";

export const metadata = { title: "Marka ekle | AdScore" };

export default function NewBrandPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl">Marka ekle</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Araştırma ve strateji bu markanın çalışma alanında yürüyecek. Bilgileri
        sonradan düzenleyebilirsin.
      </p>
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <BrandForm action={createBrand} submitLabel="Markayı oluştur" />
      </div>
    </div>
  );
}
