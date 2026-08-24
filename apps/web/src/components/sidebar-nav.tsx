"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Home,
  Megaphone,
  Plug,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Tags,
  Users,
} from "lucide-react";
import { cn } from "@/components/ui";

// Global (marka bağımsız) yollar. Modüllerin çoğu markaya bağlı olduğundan
// aşağıda ayrıca aktif markanın bölümleri listelenir.
const globalItems = [
  { href: "/app", label: "Ana sayfa", icon: Home },
  { href: "/app/brands", label: "Markalar", icon: Tags },
  { href: "/app/settings/meta", label: "Meta bağlantısı", icon: Plug },
  { href: "/app/settings/meta-usage", label: "Meta kullanımı", icon: Activity },
  { href: "/app/settings", label: "Ayarlar", icon: Settings },
] as const;

// Marka seçiliyken açılan bölümler — hepsi mevcut rotalar.
const brandItems = [
  { seg: "", label: "Marka & araştırma", icon: Search },
  { seg: "/competitors", label: "Rakipler", icon: Users },
  { seg: "/arena", label: "Arena", icon: Swords },
  { seg: "/creatives", label: "Creative Studio", icon: Sparkles },
  { seg: "/campaigns", label: "Kampanyalar", icon: Megaphone },
  { seg: "/optimization", label: "Optimizasyon", icon: BarChart3 },
  { seg: "/launch", label: "Launch", icon: Rocket },
] as const;

const linkBase =
  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-300";

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  // /app/brands/<id>/... → aktif marka. "new" bir marka değil.
  const brandMatch = pathname.match(/^\/app\/brands\/([^/]+)/);
  const brandId =
    brandMatch && brandMatch[1] !== "new" ? brandMatch[1] : null;
  const brandBase = brandId ? `/app/brands/${brandId}` : null;

  return (
    <nav className="flex flex-col gap-0.5">
      {globalItems.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/app"
            ? pathname === "/app"
            : item.href === "/app/settings"
              ? pathname === "/app/settings"
              : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              linkBase,
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={15} />
            {item.label}
          </Link>
        );
      })}

      {brandBase ? (
        <>
          <span className="mt-4 px-2.5 text-[10px] uppercase tracking-wide text-muted-foreground/60">
            Seçili marka
          </span>
          {brandItems.map((item) => {
            const Icon = item.icon;
            const href = `${brandBase}${item.seg}`;
            const active = item.seg
              ? pathname.startsWith(href)
              : pathname === brandBase;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  linkBase,
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </>
      ) : null}

      {isAdmin ? (
        <Link
          href="/admin"
          className={cn(
            "mt-4",
            linkBase,
            "text-muted-foreground hover:text-foreground",
          )}
        >
          <ShieldCheck size={15} />
          Admin
        </Link>
      ) : null}
    </nav>
  );
}
