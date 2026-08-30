import { cn } from "@/components/ui";

/*
 * Bağımlılıksız çubuk grafik (2026-08-30).
 * KURAL: yalnız GERÇEK kayıtlardan çizilir. Veri yoksa çağıran taraf
 * grafiği hiç göstermez / dürüst boş durum basar (CLAUDE.md §6, §28, §31).
 * Sunucu bileşeni: hover ipucu CSS ile, JS yok.
 */

export type BarPoint = {
  /** X ekseni etiketi (kısa) */
  label: string;
  /** Gerçek değer */
  value: number;
  /** İpucunda gösterilecek tam açıklama */
  hint?: string;
};

export function BarChart({
  points,
  height = 180,
  valueFormat = (v: number) => String(v),
  tone = "accent",
  className,
}: {
  points: BarPoint[];
  height?: number;
  valueFormat?: (v: number) => string;
  tone?: "accent" | "positive";
  className?: string;
}) {
  if (points.length === 0) return null;

  const max = Math.max(...points.map((p) => p.value));
  // Tümü 0 ise ölçek 1 kabul edilir; sahte yükseklik üretilmez, hepsi sıfır çizilir.
  const scale = max > 0 ? max : 1;
  // Y ekseni: 0 / orta / tepe — uydurma yuvarlama yok, gerçek tepe değeri yazılır.
  const ticks = [scale, scale / 2, 0];

  return (
    <div className={cn("flex gap-3", className)}>
      <div
        className="flex shrink-0 flex-col justify-between py-0.5 text-right text-[10px] tabular-nums text-muted-foreground"
        style={{ height }}
        aria-hidden
      >
        {ticks.map((t, i) => (
          <span key={i}>{valueFormat(t)}</span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="relative flex items-end gap-[3px] border-b border-border-soft"
          style={{ height }}
        >
          {/* yatay kılavuz çizgileri */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-border-soft" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border-soft" />
          </div>

          {points.map((p, i) => (
            <div
              key={`${p.label}-${i}`}
              className="group relative flex min-w-0 flex-1 items-end justify-center"
              style={{ height }}
            >
              <div
                className={cn(
                  "w-full rounded-t-[3px] transition-opacity duration-300 group-hover:opacity-80",
                  tone === "accent" ? "bg-accent" : "bg-positive",
                )}
                style={{
                  height: `${Math.max((p.value / scale) * 100, p.value > 0 ? 2 : 0)}%`,
                }}
              >
                <span className="sr-only">
                  {p.label}: {valueFormat(p.value)}
                </span>
              </div>
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-soft bg-panel px-2.5 py-1.5 text-left shadow-pop group-hover:block">
                <div className="text-[11px] font-medium">{p.label}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      tone === "accent" ? "bg-accent" : "bg-positive",
                    )}
                  />
                  {p.hint ?? valueFormat(p.value)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-1.5 flex gap-[3px] text-[10px] text-muted-foreground">
          {points.map((p, i) => (
            <span
              key={`${p.label}-x-${i}`}
              className="min-w-0 flex-1 truncate text-center"
            >
              {/* çok yoğunsa etiketler seyreltilir */}
              {points.length > 12 && i % Math.ceil(points.length / 8) !== 0
                ? ""
                : p.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
