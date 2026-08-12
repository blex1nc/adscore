"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  Megaphone,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import { cn } from "@/components/ui";

const items = [
  { href: "/app", label: "Ana sayfa", icon: Home },
  { href: "/app/brands", label: "Markalar", icon: Tags },
  { label: "Araştırma", icon: Search, phase: "Phase 2" },
  { label: "Rakipler", icon: Users, phase: "Phase 3" },
  { label: "Creative Studio", icon: Sparkles, phase: "Phase 4" },
  { label: "Kampanyalar", icon: Megaphone, phase: "Phase 6" },
  { label: "Analytics", icon: BarChart3, phase: "Phase 5" },
  { href: "/app/settings", label: "Ayarlar", icon: Settings },
] as const;

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        if (!("href" in item)) {
          // Henüz olmayan modül tıklanabilir görünmez; sahte sayfa yok
          return (
            <span
              key={item.label}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground/50"
              title={`${item.phase} ile gelecek`}
            >
              <Icon size={15} />
              {item.label}
              <span className="ml-auto text-[10px] uppercase tracking-wide">
                yakında
              </span>
            </span>
          );
        }
        const active =
          item.href === "/app"
            ? pathname === "/app"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-300",
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
      {isAdmin ? (
        <Link
          href="/admin"
          className="mt-4 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
        >
          <ShieldCheck size={15} />
          Admin
        </Link>
      ) : null}
    </nav>
  );
}
