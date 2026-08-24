import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { cn } from "@/components/ui";
import type { LaunchStep } from "./launch-state";

const STATUS_LABELS: Record<LaunchStep["status"], string> = {
  done: "Tamamlandı",
  active: "Sırada",
  available: "Opsiyonel",
  locked: "Kilitli",
  skipped: "Atlandı",
};

export function StatusChip({
  status,
  running,
  label,
}: {
  status: LaunchStep["status"];
  running?: boolean;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
        status === "done" && "border-accent/40 text-accent",
        status === "active" && "border-accent text-accent",
        status === "locked" && "border-border text-muted-foreground/70",
        (status === "available" || status === "skipped") &&
          "border-border text-muted-foreground",
        running && "animate-pulse",
      )}
    >
      {label ?? (running ? "Sürüyor" : STATUS_LABELS[status])}
    </span>
  );
}

// Aktif adımın çerçevesi: başlık + durum + açıklama; altta detay ve sonraki adım
export function StepPanel({
  step,
  description,
  nextHref,
  nextLabel,
  detailLabel,
  children,
}: {
  step: LaunchStep;
  description: string;
  nextHref?: string | null;
  nextLabel?: string;
  detailLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground">
              {String(step.index).padStart(2, "0")}
            </span>
            <h2 className="text-base font-medium">{step.title}</h2>
            <StatusChip status={step.status} running={step.running} />
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {description}
          </p>
          {step.note ? (
            <p
              className={cn(
                "mt-2 text-xs",
                step.status === "locked"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {step.note}
            </p>
          ) : null}
        </div>
        <Link
          href={step.detailHref}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-300 hover:text-foreground"
        >
          {detailLabel ?? "Detay sayfasında aç"}
          <ExternalLink size={12} />
        </Link>
      </div>

      {step.status === "locked" ? null : (
        <div className="mt-5 border-t border-border pt-5">{children}</div>
      )}

      {nextHref ? (
        <div className="mt-5 flex justify-end border-t border-border pt-4">
          <Link
            href={nextHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-85"
          >
            {nextLabel ?? "Sonraki adım"}
            <ArrowRight size={13} />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
