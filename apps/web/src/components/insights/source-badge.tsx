// Sonuç kaynağı rozeti — Meta'dan gelen sayı ile elle girilen sayı ASLA
// karıştırılmaz (AGENT-C.md §4); kaynak her sonuç satırında görünür.
// META_API sonuçlarında attribution + çekilme tarihi notu da gösterilir (§38).

import { cn } from "@/components/ui";

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Elle",
  CSV: "CSV",
  META_API: "Meta API",
};

export function ResultSourceBadge({
  source,
  notes,
}: {
  source: string;
  notes?: string | null;
}) {
  const label = SOURCE_LABELS[source] ?? source;
  const isMeta = source === "META_API";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
          isMeta ? "border-accent/40 text-accent" : "border-border-soft text-muted-foreground",
        )}
        title={
          isMeta
            ? "Bu sonuç Meta API'den senkronlandı. Dönüşüm sayıları attribution penceresine bağlıdır ve geriye dönük değişebilir."
            : source === "CSV"
              ? "Bu sonuç Ads Manager CSV raporundan içe aktarıldı."
              : "Bu sonuç elle girildi."
        }
      >
        {label}
      </span>
      {isMeta && notes ? (
        <span className="text-[10px] text-muted-foreground">{notes}</span>
      ) : null}
    </span>
  );
}
