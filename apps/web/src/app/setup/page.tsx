import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@adscore/db";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Kurulum | AdScore" };

export default async function SetupPage() {
  const userCount = await prisma.user.count();
  if (userCount > 0) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 block text-center text-xl font-semibold tracking-tight"
        >
          adscore
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-dashboard">
          <h1 className="font-display text-2xl">İlk kurulum</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Henüz hiç hesap yok. Oluşturacağın ilk hesap yönetici olur; sonra
            bu sayfa kalıcı olarak kapanır.
          </p>
          <SetupForm />
        </div>
      </div>
    </main>
  );
}
