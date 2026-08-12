import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Giriş yap | AdScore" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
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
          <h1 className="font-display text-2xl">Giriş yap</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AdScore şu an davetli erken erişimde.
          </p>
          <Suspense>
            <LoginForm next={next} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
