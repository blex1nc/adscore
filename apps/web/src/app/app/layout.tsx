import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/actions/auth";
import { SidebarNav } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-border px-3 py-5 md:flex">
        <Link
          href="/app"
          className="mb-6 px-2.5 text-lg font-semibold tracking-tight"
        >
          adscore
        </Link>
        <SidebarNav isAdmin={user.platformRole === "ADMIN"} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="truncate text-sm text-muted-foreground">
            {user.workspace?.name ?? "Workspace"}
          </span>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <span
              className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium"
              title={user.email}
            >
              {initials}
            </span>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Çıkış yap"
                className="rounded-full border border-border bg-card p-2 text-muted-foreground transition-colors duration-300 hover:text-foreground"
              >
                <LogOut size={15} />
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-5 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
