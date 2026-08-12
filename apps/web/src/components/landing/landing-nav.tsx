"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Hexagon, Menu, X } from "lucide-react";

// Not: Referansın logo SVG path'i eksik geldi ("M1.04356 6.35771..." kesik).
// Tam path gelene kadar beyaz hexagon + wordmark kullanılıyor.
const links = [
  { label: "Ana sayfa", href: "/" },
  { label: "Özellikler", href: "#nasil-calisir", chevron: true },
  { label: "Nasıl çalışır", href: "#nasil-calisir" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-20 w-full">
      <div className="flex items-center justify-between px-6 py-[16px] lg:px-[120px]">
        <div className="flex items-center gap-10">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
          >
            <Hexagon size={22} strokeWidth={1.5} />
            adscore
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex items-center gap-1 font-manrope text-sm font-medium text-foreground transition-opacity duration-300 hover:opacity-80"
              >
                {link.label}
                {link.chevron ? <ChevronDown size={14} /> : null}
              </a>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-[8px] border border-surface-border bg-surface px-4 py-2 font-manrope text-sm font-semibold text-surface-foreground transition-opacity duration-300 hover:opacity-90"
          >
            Giriş yap
          </Link>
          <Link
            href="/login"
            className="rounded-[8px] bg-accent px-4 py-2 font-manrope text-sm font-semibold text-accent-foreground shadow-sm transition-opacity duration-300 hover:opacity-90"
          >
            Panele gir
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menüyü aç"
          className="text-foreground md:hidden"
        >
          <Menu size={24} />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background px-6 py-[16px] md:hidden">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Hexagon size={22} strokeWidth={1.5} />
              adscore
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Menüyü kapat"
            >
              <X size={24} />
            </button>
          </div>
          <nav className="mt-10 flex flex-col gap-6">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="font-manrope text-lg font-medium"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="mt-4 rounded-[8px] bg-accent px-4 py-3 text-center font-manrope text-sm font-semibold text-accent-foreground"
            >
              Panele gir
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
