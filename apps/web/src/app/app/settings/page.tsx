import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Ayarlar | AdScore" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl">Ayarlar</h1>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-medium">Hesap</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-24 text-muted-foreground">İsim</dt>
            <dd>{user.name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 text-muted-foreground">E-posta</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 text-muted-foreground">Workspace</dt>
            <dd>{user.workspace?.name}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-medium">Şifre değiştir</h2>
        <ChangePasswordForm />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-medium">Meta bağlantısı</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Meta Business hesabın panel üzerinden, resmi OAuth akışıyla
          bağlanacak. Token girme veya kod düzenleme gerekmeyecek. Phase 5 ile
          geliyor.
        </p>
      </div>
    </div>
  );
}
