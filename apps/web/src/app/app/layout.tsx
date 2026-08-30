import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/actions/auth";
import { SidebarNav } from "@/components/sidebar-nav";
import { PanelMobileNav } from "@/components/panel-mobile-nav";
import { Breadcrumb } from "@/components/panel/breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";

/*
 * PANEL KABUĞU (2026-08-30 — referans panel dili)
 * Gri zemin (canvas) üstünde: solda sidebar, sağda yuvarlatılmış içerik paneli.
 * İçerik paneli kendi başlık çubuğunu taşır (breadcrumb + hesap kontrolleri).
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Sidebar marka değiştirici + breadcrumb için (yalnız id + ad).
  const brands = user.workspace
    ? await prisma.brand.findMany({
        where: { workspaceId: user.workspace.id },
        select: { id: true, name: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const workspaceName = user.workspace?.name ?? "Workspace";
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-screen gap-0 bg-canvas p-0 md:gap-2 md:p-2">
      <aside className="hidden w-[248px] shrink-0 flex-col px-2 py-2 md:flex">
        <Link
          href="/app"
          className="mb-3 px-1.5 text-[17px] font-semibold tracking-tight"
        >
          adscore
        </Link>
        <SidebarNav
          isAdmin={user.platformRole === "ADMIN"}
          brands={brands}
          workspaceName={workspaceName}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-border-soft bg-panel-2 md:rounded-xl md:border md:shadow-card">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft bg-panel px-4 py-2.5 md:rounded-t-xl">
          <div className="flex min-w-0 items-center gap-2.5">
            <PanelMobileNav
              isAdmin={user.platformRole === "ADMIN"}
              brands={brands}
              workspaceName={workspaceName}
            />
            <Breadcrumb brands={brands} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <span
              className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium"
              title={`${user.name} · ${user.email}`}
            >
              {initials}
            </span>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Çıkış yap"
                className="rounded-full border border-border-soft bg-panel p-2 text-muted-foreground transition-colors duration-300 hover:text-foreground"
              >
                <LogOut size={15} />
              </button>
            </form>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
