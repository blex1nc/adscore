import { createBrand } from "@/actions/brands";
import { BrandForm } from "@/components/brand-form";

export const metadata = { title: "Marka ekle | AdScore" };

export default function NewBrandPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Marka ekle</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Araştırma ve strateji bu markanın çalışma alanında yürüyecek. Bilgileri
        sonradan düzenleyebilirsin.
      </p>
      <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6">
        <BrandForm action={createBrand} submitLabel="Markayı oluştur" />
      </div>
    </div>
  );
}
