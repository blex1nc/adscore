"use client";

import { useState } from "react";
import { cn } from "@/components/ui";
import {
  AdPreview,
  CharMeters,
  PLACEMENT_LABELS,
  type FeedRatio,
  type PreviewBrand,
  type PreviewCreative,
  type PreviewPlacement,
} from "./ad-preview";

const PLACEMENTS: PreviewPlacement[] = ["feed", "story", "reels"];

// Akış / Hikâye / Reels sekmeli önizleme. Sekme etiketleri nötr; platform
// adı/logo yok (CONTRACTS §7).
export function PreviewTabs({
  creative,
  imageUrl,
  brand,
  compact,
}: {
  creative: PreviewCreative;
  imageUrl?: string | null;
  brand: PreviewBrand;
  compact?: boolean;
}) {
  const [placement, setPlacement] = useState<PreviewPlacement>("feed");
  const [feedRatio, setFeedRatio] = useState<FeedRatio>("1x1");

  return (
    <div className={cn(compact ? "space-y-3" : "space-y-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Yerleşim"
          className="inline-flex rounded-full border border-border bg-card p-0.5"
        >
          {PLACEMENTS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={placement === p}
              onClick={() => setPlacement(p)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-300",
                placement === p
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PLACEMENT_LABELS[p]}
            </button>
          ))}
        </div>
        {placement === "feed" ? (
          <div
            role="radiogroup"
            aria-label="Akış görsel oranı"
            className="inline-flex gap-1 text-[11px]"
          >
            {(["1x1", "4x5"] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={feedRatio === r}
                onClick={() => setFeedRatio(r)}
                className={cn(
                  "rounded-full border px-2.5 py-1 transition-colors duration-300",
                  feedRatio === r
                    ? "border-accent/40 text-accent"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {r === "1x1" ? "1:1" : "4:5"}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">9:16</span>
        )}
      </div>

      <AdPreview
        creative={creative}
        imageUrl={imageUrl}
        brand={brand}
        placement={placement}
        feedRatio={feedRatio}
        className={compact ? "max-w-[260px]" : undefined}
      />

      <CharMeters creative={creative} />
    </div>
  );
}
