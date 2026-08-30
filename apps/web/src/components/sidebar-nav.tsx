"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Library,
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
  { seg: "/ad-library", label: "Ad Library", icon: Library },
  { seg: "/arena", label: "Arena", icon: Swords },
  { seg: "/creatives", label: "Creative Studio", icon: Sparkles },
  { seg: "/campaigns", label: "Kampanyalar", icon: Megaphone },
  { seg: "/optimization", label: "Optimizasyon", icon: BarChart3 },
  { seg: "/launch", label: "Launch", icon: Rocket },
] as const;

// Marka değiştirirken aynı modülde kalabilmek için tanınan üst segmentler.
const brandSegments: string[] = brandItems
  .map((i) => i.seg)
  .filter((seg) => seg !== "");

const linkBase =
  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-300";

export type SidebarBrand = { id: string; name: string };

export function SidebarNav({
  isAdmin,
  brands,
  onNavigate,
}: {
  isAdmin: boolean;
  brands: SidebarBrand[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // /app/brands/<id>/... → aktif marka. "new" bir marka değil.
  const brandMatch = pathname.match(/^\/app\/brands\/([^/]+)/);
  const brandId =
    brandMatch && brandMatch[1] !== "new" ? brandMatch[1] : null;
  const brandBase = brandId ? `/app/brands/${brandId}` : null;

  // Şu an hangi marka modülündeyiz? Marka değişince aynı modüle geçilir.
  const currentSeg =
    brandBase && pathname.length > brandBase.length
      ? (brandSegments.find((seg) => pathname.startsWith(`${brandBase}${seg}`)) ??
        "")
      : "";

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
            onClick={onNavigate}
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

      {brands.length > 0 ? (
        <>
          <span className="mt-4 px-2.5 text-[10px] uppercase tracking-wide text-muted-foreground/60">
            Seçili marka
          </span>
          <label className="sr-only" htmlFor="sidebar-brand-switch">
            Marka seç
          </label>
          <select
            id="sidebar-brand-switch"
            value={brandId ?? ""}
            onChange={(e) => {
              const next = e.target.value;
              onNavigate?.();
              // Boş seçim = marka bağlamından çık, liste ekranına dön.
              router.push(next ? `/app/brands/${next}${currentSeg}` : "/app/brands");
            }}
            className="mx-0.5 mt-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm text-card-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            <option value="">
              {brandId ? "Tüm markalar…" : "Marka seç…"}
            </option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {brandBase ? (
        <div className="mt-1 flex flex-col gap-0.5">
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
                onClick={onNavigate}
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
        </div>
      ) : brands.length > 0 ? (
        <p className="px-2.5 pt-2 text-xs text-muted-foreground">
          Modüller marka bazlıdır; yukarıdan bir marka seç.
        </p>
      ) : null}

      {isAdmin ? (
        <Link
          href="/admin"
          onClick={onNavigate}
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
