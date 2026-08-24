// Ad Library'den gelen rakip reklamının kaynak rozeti — elle eklenen içerikle
// API'den gelen referans karışmaz (kaynak her zaman görünür, CLAUDE.md §37).

export function AdLibraryBadge({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span
      className="rounded-full border border-accent/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent"
      title="Bu kayıt Meta Ad Library'den alındı; yalnız metin referansı saklanır, görsel içerik kopyalanmaz."
    >
      Ad Library
    </span>
  );
}
