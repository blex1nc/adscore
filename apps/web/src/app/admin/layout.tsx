import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.platformRole !== "ADMIN") redirect("/app");

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold tracking-tight">adscore</span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            admin
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Panele dön
          </Link>
        </div>
      </header>
      <main className="px-5 py-6 md:px-8">{children}</main>
    </div>
  );
}
