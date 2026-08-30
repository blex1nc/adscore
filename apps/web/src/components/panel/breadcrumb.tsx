"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, House } from "lucide-react";
import type { SidebarBrand } from "@/components/sidebar-nav";

/*
 * Breadcrumb (2026-08-30) — referans paneldeki "Home / Site Curves / X" satırı.
 * Etiketler bilinen rotalardan türetilir; bilinmeyen segment ham gösterilmez,
 * kısaltılmış id olarak yazılır (uydurma başlık yok).
 */

const SEGMENT_LABELS: Record<string, string> = {
  brands: "Markalar",
  new: "Yeni marka",
  competitors: "Rakipler",
  "ad-library": "Ad Library",
  arena: "Arena",
  creatives: "Creative Studio",
  campaigns: "Kampanyalar",
  kit: "Kurulum kiti",
  publish: "Yayın",
  optimization: "Optimizasyon",
  launch: "Launch",
  settings: "Ayarlar",
  meta: "Meta bağlantısı",
  "meta-usage": "Meta kullanımı",
};

export function Breadcrumb({ brands }: { brands: SidebarBrand[] }) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean); // ["app", ...]
  if (parts[0] !== "app") return null;

  const crumbs: Array<{ label: string; href: string }> = [];
  let href = "/app";
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    href += `/${seg}`;
    const brand = brands.find((b) => b.id === seg);
    if (brand) {
      crumbs.push({ label: brand.name, href });
      continue;
    }
    const known = SEGMENT_LABELS[seg];
    crumbs.push({
      // Bilinmeyen segment büyük ihtimalle bir kayıt id'si: kısaltılır.
      label: known ?? (seg.length > 12 ? `${seg.slice(0, 6)}…` : seg),
      href,
    });
  }

  return (
    <nav aria-label="Konum" className="flex min-w-0 items-center gap-1 text-[13px]">
      <Link
        href="/app"
        className="flex items-center gap-1.5 text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <House size={14} />
        Ana sayfa
      </Link>
      {crumbs.map((c, i) => (
        <Fragment key={c.href}>
          <ChevronRight size={13} className="shrink-0 text-muted-foreground/50" />
          {i === crumbs.length - 1 ? (
            <span className="truncate font-medium">{c.label}</span>
          ) : (
            <Link
              href={c.href}
              className="truncate text-muted-foreground transition-colors duration-300 hover:text-foreground"
            >
              {c.label}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
