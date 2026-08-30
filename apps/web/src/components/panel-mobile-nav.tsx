"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { SidebarNav, type SidebarBrand } from "@/components/sidebar-nav";

// Masaüstünde sidebar kalıcı; mobilde (md altı) hiç gezinme yoktu.
// Bu bileşen aynı SidebarNav'ı çekmece olarak açar.
export function PanelMobileNav({
  isAdmin,
  brands,
  workspaceName,
}: {
  isAdmin: boolean;
  brands: SidebarBrand[];
  workspaceName: string;
}) {
  const pathname = usePathname();
  // Çekmece hangi rotada açıldıysa onunla saklanır: rota değişince (link
  // tıklaması ya da geri/ileri) render sırasında kapanmış sayılır — effect'te
  // setState çağırmaya gerek kalmaz.
  const [state, setState] = useState({ open: false, path: pathname });
  const open = state.open && state.path === pathname;
  const setOpen = (next: boolean) =>
    setState(next ? { open: true, path: pathname } : { open: false, path: pathname });

  // Çekmece açıkken arka plan kaymasın.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState((prev) => ({ ...prev, open: false }));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menüyü aç"
        aria-expanded={open}
        className="rounded-full border border-border-soft bg-panel p-2 text-muted-foreground transition-colors duration-300 hover:text-foreground md:hidden"
      >
        <Menu size={15} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Menüyü kapat"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-background/80"
          />
          <div className="absolute inset-y-0 left-0 flex w-[268px] flex-col overflow-y-auto border-r border-border-soft bg-canvas px-2.5 py-4">
            <div className="mb-6 flex items-center justify-between px-2.5">
              <Link href="/app" className="text-lg font-semibold tracking-tight">
                adscore
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Menüyü kapat"
                className="text-muted-foreground transition-colors duration-300 hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <SidebarNav
              isAdmin={isAdmin}
              brands={brands}
              workspaceName={workspaceName}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
