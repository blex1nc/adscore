import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/components/ui";

/*
 * PANEL KİTİ (2026-08-30)
 * Referans panel dili: gri zemin üstünde beyaz kartlar, ince kenarlık,
 * yumuşak gölge. Renkler yalnız token katmanından gelir (HANDOFF 21.3).
 * Hepsi server component — sayfalar doğrudan kullanabilir.
 */

/** Sayfa başlığı: ikon + başlık + açıklama + sağda aksiyonlar. */
export function PageHeader({
  title,
  description,
  icon,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
          {icon ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-panel-2 text-muted-foreground">
              {icon}
            </span>
          ) : null}
          <span className="truncate">{title}</span>
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Beyaz kart yüzeyi. */
export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border-soft bg-panel shadow-card",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Kart başlığı: sol başlık + not, sağda kontroller (referanstaki "Monthly ▾" yeri). */
export function CardHeader({
  title,
  note,
  actions,
  icon,
}: {
  title: ReactNode;
  note?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
          {title}
        </h2>
        {note ? (
          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Referanstaki filtre çipi görünümü (statik etiket). */
export function Chip({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "positive" | "negative";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
        tone === "default" && "border-border-soft bg-panel-2 text-muted-foreground",
        tone === "accent" && "border-accent/30 bg-accent/10 text-accent",
        tone === "positive" && "border-positive/30 bg-positive/10 text-positive",
        tone === "negative" && "border-negative/30 bg-negative/10 text-negative",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Tek sayı kutusu. Değer GERÇEK kayıttan gelmelidir (CLAUDE.md §6, §31). */
export function StatTile({
  label,
  value,
  note,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-soft bg-panel-2 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</div>
      {note ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{note}</div>
      ) : null}
    </div>
  );
}

/** Boş / veri yok durumu — sahte içerik yerine dürüst açıklama. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-soft bg-panel-2 px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-muted-foreground">{icon}</div> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Kart içi ince bağlantı (referanstaki "Read guide →"). */
export function CardLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs text-accent transition-opacity duration-300 hover:opacity-80"
    >
      {children}
    </Link>
  );
}
