import { cn } from "@/components/ui";

// Reklam önizlemesi — NÖTR çerçeveler. Instagram/Facebook logosu, ikon seti
// veya adı bilinçli olarak kullanılmaz (CONTRACTS §7). Yerleşim adları:
// "Akış / Hikâye / Reels". Bileşen saf render'dır (hook yok); hem server hem
// client tarafında kullanılabilir.

export type PreviewPlacement = "feed" | "story" | "reels";
export type FeedRatio = "1x1" | "4x5";

export type PreviewCreative = {
  primaryText: string;
  headline: string;
  description?: string | null;
  cta: string;
};

export type PreviewBrand = {
  name: string;
  // BrandAsset LOGO servis URL'i (/api/brand-assets/[id]); yoksa baş harf
  logoUrl?: string | null;
};

// Eşikler Ajan A'nın lint kurallarıyla aynı (AGENT-C §4): 125 / 40
export const PRIMARY_TEXT_VISIBLE_LIMIT = 125;
export const HEADLINE_LIMIT = 40;

export const PLACEMENT_LABELS: Record<PreviewPlacement, string> = {
  feed: "Akış",
  story: "Hikâye",
  reels: "Reels",
};

// Primary text'i görünür kısım + katlanan kısım olarak ayırır.
// Platformlar ilk ~125 karakteri gösterip kalanı "daha fazla" altına alır.
export function splitPrimaryText(text: string) {
  const chars = Array.from(text.trim());
  if (chars.length <= PRIMARY_TEXT_VISIBLE_LIMIT) {
    return { visible: chars.join(""), hidden: "", truncated: false };
  }
  return {
    visible: chars.slice(0, PRIMARY_TEXT_VISIBLE_LIMIT).join(""),
    hidden: chars.slice(PRIMARY_TEXT_VISIBLE_LIMIT).join(""),
    truncated: true,
  };
}

export function charCount(text: string) {
  return Array.from(text.trim()).length;
}

// Dikey çerçeveler (Hikâye/Reels) data-theme="dark" ile koyu token'a
// kilitlenir; bu yüzden burada tema-bağımsız tek bir token seti yeter.
function BrandMark({ brand }: { brand: PreviewBrand }) {
  const initial = brand.name.trim().charAt(0).toUpperCase() || "•";
  return (
    <div className="flex min-w-0 items-center gap-2">
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logoUrl}
          alt=""
          className="size-7 shrink-0 rounded-full border border-border bg-card object-cover"
        />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
          {initial}
        </span>
      )}
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[12px] font-semibold text-foreground">
          {brand.name}
        </div>
        <div className="text-[10px] text-muted-foreground">Sponsorlu</div>
      </div>
    </div>
  );
}

function ImageArea({
  imageUrl,
  alt,
  className,
}: {
  imageUrl?: string | null;
  alt: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={alt}
        className={cn("size-full object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex size-full items-center justify-center bg-muted text-center text-[11px] text-muted-foreground",
        className,
      )}
    >
      <span className="px-4">
        Görsel yok — bu creative için görsel üretilmedi veya yüklenmedi.
      </span>
    </div>
  );
}

// Görünür / katlanan metin; kesim noktası işaretli
function PrimaryText({ text }: { text: string }) {
  const { visible, truncated } = splitPrimaryText(text);
  return (
    <p className="whitespace-pre-wrap text-[12px] leading-snug text-foreground">
      {visible}
      {truncated ? (
        <span
          className="ml-1 font-medium text-muted-foreground"
          title={`İlk ${PRIMARY_TEXT_VISIBLE_LIMIT} karakterden sonrası katlanır`}
        >
          …daha fazla
        </span>
      ) : null}
    </p>
  );
}

function FeedFrame({
  creative,
  imageUrl,
  brand,
  ratio,
}: {
  creative: PreviewCreative;
  imageUrl?: string | null;
  brand: PreviewBrand;
  ratio: FeedRatio;
}) {
  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center justify-between px-3 py-2.5">
        <BrandMark brand={brand} />
        <span className="text-muted-foreground" aria-hidden>
          ···
        </span>
      </div>
      <div
        className={cn(
          "w-full overflow-hidden",
          ratio === "1x1" ? "aspect-square" : "aspect-[4/5]",
        )}
      >
        <ImageArea imageUrl={imageUrl} alt={`${creative.headline} görseli`} />
      </div>
      <div className="flex items-center justify-between gap-3 border-y border-border bg-muted/40 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold text-card-foreground">
            {creative.headline}
          </div>
          {creative.description ? (
            <div className="truncate text-[10px] text-muted-foreground">
              {creative.description}
            </div>
          ) : null}
        </div>
        <span className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-card-foreground">
          {creative.cta}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <PrimaryText text={creative.primaryText} />
      </div>
    </div>
  );
}

function StoryFrame({
  creative,
  imageUrl,
  brand,
}: {
  creative: PreviewCreative;
  imageUrl?: string | null;
  brand: PreviewBrand;
}) {
  return (
    // Görsel üstü karartma: çerçeve koyu token'a kilitli (data-theme="dark"),
    // böylece metin her sayfa temasında okunur; ham renk yok.
    <div
      data-theme="dark"
      className="relative h-full w-full overflow-hidden bg-muted text-foreground"
    >
      <ImageArea imageUrl={imageUrl} alt={`${creative.headline} görseli`} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-background/90 to-transparent" />
      <div className="absolute inset-x-0 top-0 px-3 pt-2.5">
        <div className="mb-2 h-0.5 w-full rounded-full bg-foreground/40">
          <div className="h-0.5 w-1/3 rounded-full bg-foreground" />
        </div>
        <BrandMark brand={brand} />
      </div>
      <div className="absolute inset-x-0 bottom-0 px-3 pb-4">
        <div className="text-[13px] font-semibold text-foreground">
          {creative.headline}
        </div>
        <div className="mt-1">
          <PrimaryText text={creative.primaryText} />
        </div>
        <div className="mt-3 flex justify-center">
          <span className="rounded-full bg-foreground px-4 py-1.5 text-[11px] font-semibold text-background">
            {creative.cta}
          </span>
        </div>
      </div>
    </div>
  );
}

function ReelsFrame({
  creative,
  imageUrl,
  brand,
}: {
  creative: PreviewCreative;
  imageUrl?: string | null;
  brand: PreviewBrand;
}) {
  return (
    <div
      data-theme="dark"
      className="relative h-full w-full overflow-hidden bg-muted text-foreground"
    >
      <ImageArea imageUrl={imageUrl} alt={`${creative.headline} görseli`} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-linear-to-t from-background/90 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-3 pb-4">
        <div className="min-w-0 flex-1">
          <BrandMark brand={brand} />
          <div className="mt-2">
            <PrimaryText text={creative.primaryText} />
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-md bg-muted/80 px-2.5 py-1.5 backdrop-blur-sm">
            <span className="truncate text-[11px] font-semibold text-foreground">
              {creative.headline}
            </span>
            <span className="shrink-0 rounded-md bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background">
              {creative.cta}
            </span>
          </div>
        </div>
        {/* Sağ dikey aksiyon sütunu — nötr boş daireler, ikon seti yok */}
        <div className="flex shrink-0 flex-col items-center gap-3 pb-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-6 rounded-full border border-foreground/50"
              aria-hidden
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdPreview({
  creative,
  imageUrl,
  brand,
  placement,
  feedRatio = "1x1",
  className,
}: {
  creative: PreviewCreative;
  imageUrl?: string | null;
  brand: PreviewBrand;
  placement: PreviewPlacement;
  feedRatio?: FeedRatio;
  className?: string;
}) {
  const vertical = placement !== "feed";
  return (
    <div
      className={cn(
        // Telefon silueti
        "mx-auto w-full max-w-[300px] overflow-hidden rounded-[28px] border-4 border-foreground/80 bg-card shadow-dashboard",
        className,
      )}
      aria-label={`${PLACEMENT_LABELS[placement]} önizlemesi`}
    >
      <div className="mx-auto mt-1.5 h-1 w-16 rounded-full bg-foreground/40" />
      <div className={cn("mt-1.5", vertical ? "aspect-[9/16]" : "")}>
        {placement === "feed" ? (
          <FeedFrame
            creative={creative}
            imageUrl={imageUrl}
            brand={brand}
            ratio={feedRatio}
          />
        ) : placement === "story" ? (
          <StoryFrame creative={creative} imageUrl={imageUrl} brand={brand} />
        ) : (
          <ReelsFrame creative={creative} imageUrl={imageUrl} brand={brand} />
        )}
      </div>
    </div>
  );
}

// Karakter sayaçları — 125 (primary text görünür sınırı) ve 40 (başlık).
export function CharMeters({ creative }: { creative: PreviewCreative }) {
  const primary = charCount(creative.primaryText);
  const headline = charCount(creative.headline);
  const primaryOver = primary > PRIMARY_TEXT_VISIBLE_LIMIT;
  const headlineOver = headline > HEADLINE_LIMIT;
  return (
    <dl className="grid grid-cols-2 gap-3 text-xs">
      <div>
        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Primary text
        </dt>
        <dd
          className={cn(
            "mt-0.5 tabular-nums",
            primaryOver ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {primary} / {PRIMARY_TEXT_VISIBLE_LIMIT}
          <span className="ml-1 text-muted-foreground">
            {primaryOver
              ? `· ${primary - PRIMARY_TEXT_VISIBLE_LIMIT} karakter katlanır`
              : "· tamamı görünür"}
          </span>
        </dd>
      </div>
      <div>
        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Başlık
        </dt>
        <dd
          className={cn(
            "mt-0.5 tabular-nums",
            headlineOver ? "text-destructive" : "text-foreground",
          )}
        >
          {headline} / {HEADLINE_LIMIT}
          {headlineOver ? (
            <span className="ml-1">· sınır aşıldı, kesilebilir</span>
          ) : null}
        </dd>
      </div>
    </dl>
  );
}
