"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  ChevronDown,
  ChevronsUpDown,
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

/*
 * PANEL SIDEBAR (2026-08-30 — referans panel dili)
 * Üstte workspace çipi + marka değiştirici, altında aranabilir ve katlanabilir
 * gezinme grupları. Renkler yalnız token katmanından (HANDOFF 21.3).
 */

// Global (marka bağımsız) yollar.
const globalItems = [
  { href: "/app", label: "Ana sayfa", icon: Home },
  { href: "/app/brands", label: "Markalar", icon: Tags },
] as const;

const settingsItems = [
  { href: "/app/settings/meta", label: "Meta bağlantısı", icon: Plug },
  { href: "/app/settings/meta-usage", label: "Meta kullanımı", icon: Activity },
  { href: "/app/settings", label: "Ayarlar", icon: Settings },
] as const;

// Marka modülleri — üç iş grubuna ayrıldı, hepsi mevcut rotalar.
const brandGroups = [
  {
    key: "arastirma",
    label: "Araştırma",
    items: [
      { seg: "", label: "Marka & araştırma", icon: Search },
      { seg: "/competitors", label: "Rakipler", icon: Users },
      { seg: "/ad-library", label: "Ad Library", icon: Library },
    ],
  },
  {
    key: "uretim",
    label: "Üretim",
    items: [
      { seg: "/arena", label: "Arena", icon: Swords },
      { seg: "/creatives", label: "Creative Studio", icon: Sparkles },
    ],
  },
  {
    key: "yayin",
    label: "Yayın & analiz",
    items: [
      { seg: "/campaigns", label: "Kampanyalar", icon: Megaphone },
      { seg: "/launch", label: "Launch", icon: Rocket },
      { seg: "/optimization", label: "Optimizasyon", icon: BarChart3 },
    ],
  },
] as const;

const brandSegments: string[] = brandGroups
  .flatMap((g) => g.items.map((i) => i.seg))
  .filter((seg) => seg !== "");

const itemBase =
  "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors duration-300";
const itemIdle = "text-muted-foreground hover:bg-panel-2 hover:text-foreground";
const itemActive =
  "border border-border-soft bg-panel font-medium text-foreground shadow-card";

export type SidebarBrand = { id: string; name: string };

export function SidebarNav({
  isAdmin,
  brands,
  workspaceName,
  onNavigate,
}: {
  isAdmin: boolean;
  brands: SidebarBrand[];
  workspaceName: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // /app/brands/<id>/... → aktif marka. "new" bir marka değil.
  const brandMatch = pathname.match(/^\/app\/brands\/([^/]+)/);
  const brandId = brandMatch && brandMatch[1] !== "new" ? brandMatch[1] : null;
  const brandBase = brandId ? `/app/brands/${brandId}` : null;
  const activeBrand = brands.find((b) => b.id === brandId) ?? null;

  // Marka değişince aynı modülde kalınır.
  const currentSeg =
    brandBase && pathname.length > brandBase.length
      ? (brandSegments.find((seg) => pathname.startsWith(`${brandBase}${seg}`)) ??
        "")
      : "";

  const q = query.trim().toLocaleLowerCase("tr");
  const matches = (label: string) =>
    !q || label.toLocaleLowerCase("tr").includes(q);

  const visibleGroups = useMemo(
    () =>
      brandGroups
        .map((g) => ({ ...g, items: g.items.filter((i) => matches(i.label)) }))
        .filter((g) => g.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q],
  );

  const renderLink = (
    href: string,
    label: string,
    Icon: React.ComponentType<{ size?: number }>,
    active: boolean,
  ) => (
    <Link
      key={href}
      href={href}
      onClick={onNavigate}
      className={cn(itemBase, active ? itemActive : itemIdle)}
    >
      <Icon size={15} />
      <span className="truncate">{label}</span>
    </Link>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Workspace çipi */}
      <div className="flex items-center gap-2.5 rounded-lg border border-border-soft bg-panel px-2.5 py-2 shadow-card">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
          A
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-tight">
            {workspaceName}
          </span>
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
            {brands.length} marka
          </span>
        </span>
      </div>

      {/* Gezinmede arama — ⌘K odaklar */}
      <label className="relative block">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Modül ara"
          aria-label="Modül ara"
          className="w-full rounded-lg border border-border-soft bg-panel py-1.5 pl-8 pr-3 text-[13px] placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        />
      </label>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {globalItems.filter((i) => matches(i.label)).map((item) =>
          renderLink(
            item.href,
            item.label,
            item.icon,
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href) && !brandBase,
          ),
        )}

        {brands.length > 0 ? (
          <>
            <GroupLabel>Seçili marka</GroupLabel>
            <div className="relative">
              <select
                value={brandId ?? ""}
                aria-label="Marka seç"
                onChange={(e) => {
                  const next = e.target.value;
                  onNavigate?.();
                  router.push(
                    next ? `/app/brands/${next}${currentSeg}` : "/app/brands",
                  );
                }}
                className="w-full appearance-none rounded-lg border border-border-soft bg-panel py-1.5 pl-2.5 pr-7 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
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
              <ChevronsUpDown
                size={13}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          </>
        ) : null}

        {brandBase ? (
          visibleGroups.map((group) => {
            const isCollapsed = collapsed[group.key] ?? false;
            return (
              <div key={group.key} className="mt-2">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [group.key]: !isCollapsed }))
                  }
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground/70 transition-colors duration-300 hover:text-foreground"
                >
                  {group.label}
                  <ChevronDown
                    size={12}
                    className={cn(
                      "transition-transform duration-300",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                </button>
                {isCollapsed ? null : (
                  <div className="ml-[13px] mt-0.5 flex flex-col gap-0.5 border-l border-border-soft pl-2">
                    {group.items.map((item) => {
                      const href = `${brandBase}${item.seg}`;
                      const active = item.seg
                        ? pathname.startsWith(href)
                        : pathname === brandBase;
                      return renderLink(href, item.label, item.icon, active);
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : brands.length > 0 ? (
          <p className="px-2.5 pt-2 text-xs text-muted-foreground">
            Modüller marka bazlıdır; yukarıdan bir marka seç.
          </p>
        ) : null}

        <GroupLabel>Workspace</GroupLabel>
        {settingsItems.filter((i) => matches(i.label)).map((item) =>
          renderLink(
            item.href,
            item.label,
            item.icon,
            item.href === "/app/settings"
              ? pathname === "/app/settings"
              : pathname.startsWith(item.href),
          ),
        )}
        {isAdmin && matches("Admin")
          ? renderLink("/admin", "Admin", ShieldCheck, pathname.startsWith("/admin"))
          : null}

        {q && visibleGroups.length === 0 ? (
          <p className="px-2.5 pt-3 text-xs text-muted-foreground">
            “{query}” ile eşleşen modül yok.
          </p>
        ) : null}
      </nav>

      {activeBrand ? (
        <p className="truncate px-1 text-[11px] text-muted-foreground">
          Aktif marka: {activeBrand.name}
        </p>
      ) : null}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-3 px-2.5 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
      {children}
    </span>
  );
}
