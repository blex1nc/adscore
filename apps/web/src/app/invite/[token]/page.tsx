import Link from "next/link";
import { prisma } from "@adscore/db";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Davet | AdScore" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  const valid =
    invitation && !invitation.usedAt && invitation.expiresAt > new Date();

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
          {valid ? (
            <>
              <h1 className="font-display text-2xl">Hesabını oluştur</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                AdScore erken erişimine davetlisin.
              </p>
              <SignupForm token={token} email={invitation.email} />
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl">Davet geçersiz</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Bu davet linki kullanılmış, süresi dolmuş veya hatalı. Yeni bir
                davet için seni davet eden kişiyle iletişime geç.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
