import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { cn } from "@/components/ui";
import type { LaunchStep } from "./launch-state";

// Adım şeridi: tamam / aktif / kilitli / atlandı / opsiyonel. Görüntülenen
// adım ?step=n ile seçilir; kilitli adımlar tıklanmaz ve nedeni title'da.
export function Stepper({
  steps,
  viewIndex,
  baseHref,
}: {
  steps: LaunchStep[];
  viewIndex: number;
  baseHref: string;
}) {
  return (
    <ol className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {steps.map((step) => {
        const viewing = step.index === viewIndex;
        const clickable = step.status !== "locked";
        const inner = (
          <>
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors duration-300",
                step.status === "done" &&
                  "border-accent/40 bg-accent text-accent-foreground",
                step.status === "active" && "border-accent text-accent",
                step.status === "available" &&
                  "border-border-soft text-muted-foreground",
                step.status === "skipped" &&
                  "border-dashed border-border-soft text-muted-foreground",
                step.status === "locked" &&
                  "border-border-soft text-muted-foreground/50",
                step.running && "animate-pulse",
              )}
            >
              {step.status === "done" ? (
                <Check size={13} />
              ) : step.status === "locked" ? (
                <Lock size={11} />
              ) : (
                step.index
              )}
            </span>
            <span
              className={cn(
                "mt-1.5 block truncate text-[11px] leading-tight",
                viewing ? "font-medium text-foreground" : "text-muted-foreground",
                step.status === "locked" && "text-muted-foreground/60",
              )}
            >
              {step.title}
            </span>
            <span className="block text-[10px] leading-tight text-muted-foreground">
              {step.running
                ? "sürüyor"
                : step.status === "done"
                  ? "tamam"
                  : step.status === "skipped"
                    ? "atlandı"
                    : step.status === "locked"
                      ? "kilitli"
                      : step.optional
                        ? "opsiyonel"
                        : step.status === "active"
                          ? "sırada"
                          : ""}
            </span>
          </>
        );
        return (
          <li
            key={step.key}
            className={cn(
              "rounded-xl border px-2 py-2.5 text-center",
              viewing ? "border-accent/40 bg-panel" : "border-transparent",
            )}
            aria-current={viewing ? "step" : undefined}
            title={step.note}
          >
            {clickable ? (
              <Link
                href={`${baseHref}?step=${step.index}`}
                className="block"
                aria-label={`${step.index}. adım: ${step.title}`}
              >
                {inner}
              </Link>
            ) : (
              <span className="block cursor-not-allowed">{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
