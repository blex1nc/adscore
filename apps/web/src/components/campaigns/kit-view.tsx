import Link from "next/link";
import { AlertTriangle, Download, ExternalLink, ImagePlus } from "lucide-react";
import { cn } from "@/components/ui";
import { ConfidenceBadge } from "@/components/competitors/ad-analysis-view";
import { CopyBlock } from "@/components/campaigns/campaign-forms";
import {
  KitInputsForm,
  PublishedForm,
  StepCheckbox,
} from "@/components/campaigns/kit-forms";
import type { Kit, KitField, KitRatio } from "@/lib/publish-kit/types";
import { IMAGE_SPECS } from "@/lib/publish-kit/meta-fields";

const SOURCE_LABELS: Record<KitField["source"], string> = {
  plan: "plandan",
  creative: "creative'den",
  brand: "marka ayarından",
  user_input: "senin girdin",
};

const RATIO_LABELS: Record<KitRatio, string> = {
  "1x1": "1:1 Akış (kare)",
  "4x5": "4:5 Akış (dikey)",
  "9x16": "9:16 Hikâye / Reels",
};

function FieldCard({ field }: { field: KitField }) {
  const length = field.value ? [...field.value].length : 0;
  const over = field.charLimit != null && length > field.charLimit;
  return (
    <div
      id={`field-${field.id}`}
      className="rounded-xl border border-border-soft p-3"
      tabIndex={-1}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{field.label}</div>
          <div className="text-[11px] text-muted-foreground">
            {field.adsManagerPath}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {field.confidence ? <ConfidenceBadge level={field.confidence} /> : null}
          {field.value ? (
            <CopyBlock text={field.value} label="Kopyala" />
          ) : null}
        </div>
      </div>
      {field.value ? (
        <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 font-sans text-sm">
          {field.value}
        </pre>
      ) : (
        <p className="mt-2 rounded-md border border-dashed border-border-soft p-2 text-xs text-muted-foreground">
          Boş — planda bu değer yok; Ads Manager&apos;da sen belirle.
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <span>{SOURCE_LABELS[field.source]}</span>
        {field.charLimit != null && field.value ? (
          <span className={cn(over && "text-destructive")}>
            {length} karakter · {field.charLimitNote ?? "önerilen"} {field.charLimit}
            {over ? " — aşıyor, kısalt" : ""}
          </span>
        ) : null}
      </div>
      {field.why ? (
        <p className="mt-1.5 text-xs text-muted-foreground">Neden: {field.why}</p>
      ) : null}
      {field.alternative ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Alternatif: {field.alternative}
        </p>
      ) : null}
      {field.note ? <p className="mt-1 text-xs">{field.note}</p> : null}
    </div>
  );
}

export function KitView({
  kit,
  kitId,
  version,
  brandId,
  planId,
  checklist,
  publishedAt,
  publishNote,
}: {
  kit: Kit;
  kitId: string;
  version: number;
  brandId: string;
  planId: string;
  checklist: Record<string, boolean>;
  publishedAt: string | null;
  publishNote: string | null;
}) {
  const steps = kit.sections.flatMap((s) => s.steps);
  const done = steps.filter((s) => checklist[s.id]).length;
  const exportBase = `/api/publish-kits/${kitId}/export`;
  const adsWithAssets = kit.adsets.flatMap((a) =>
    a.ads.map((ad) => ({ adset: a.name, ...ad })),
  );

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <div className="rounded-lg border border-border-soft bg-panel shadow-card p-4 text-xs text-muted-foreground">
          {kit.disclaimer} Kit v{version} ·{" "}
          {new Date(kit.generatedAt).toLocaleString("tr-TR")} · alan adları{" "}
          <code>{kit.meta.fieldsDoc}</code> ({kit.meta.fieldsRetrievedAt}).
        </div>

        {kit.sections.map((section, i) => (
          <section
            key={section.id}
            id={`section-${section.id}`}
            className="rounded-lg border border-border-soft bg-panel shadow-card p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-medium">
                {i + 1}. {section.title}
              </h2>
              <CopyBlock
                label="Bölümü kopyala"
                text={section.fields
                  .filter((f) => f.value)
                  .map((f) => `${f.label}: ${f.value}`)
                  .join("\n")}
              />
            </div>
            {section.id === "ad" && kit.adsets.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {kit.adsets.length} reklam seti ·{" "}
                {kit.adsets.reduce((n, a) => n + a.ads.length, 0)} reklam (yalnız
                onaylı creative&apos;ler).
              </p>
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {section.fields.map((f) => (
                <FieldCard key={f.id} field={f} />
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-lg border border-border-soft bg-panel shadow-card p-6">
          <h2 className="text-base font-medium">Görseller (yerleşime göre)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Kaynak görsel üç orana merkezden kırpılıp ölçeklenir:{" "}
            {(Object.keys(IMAGE_SPECS) as KitRatio[])
              .map((r) => `${RATIO_LABELS[r]} ${IMAGE_SPECS[r].width}×${IMAGE_SPECS[r].height}`)
              .join(" · ")}
            . Boyutlar Meta&apos;nın resmi önerileridir; kırpma sonucunu kontrol et.
          </p>
          <div className="mt-4 space-y-5">
            {adsWithAssets.map((ad) => (
              <div key={ad.creativeId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{ad.headline}</span>
                  <span className="text-[11px] text-muted-foreground">{ad.adset}</span>
                </div>
                {ad.imageIds.length === 0 ? (
                  <p className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <ImagePlus size={13} />
                    Bu creative için görsel yok.{" "}
                    <Link
                      href={`/app/brands/${brandId}/creatives`}
                      className="text-accent"
                    >
                      Creative Studio&apos;da üret →
                    </Link>
                  </p>
                ) : (
                  ad.imageIds.map((imageId) => (
                    <div key={imageId} className="mt-3 grid gap-3 sm:grid-cols-3">
                      {(Object.keys(IMAGE_SPECS) as KitRatio[]).map((ratio) => {
                        const src = `/api/publish-kits/${kitId}/assets/${imageId}?ratio=${ratio}`;
                        return (
                          <figure key={ratio} className="text-xs">
                            {/* eslint-disable-next-line @next/next/no-img-element -- auth'lu dinamik görsel */}
                            <img
                              src={src}
                              alt={`${ad.headline} — ${RATIO_LABELS[ratio]}`}
                              className="w-full rounded-md border border-border-soft bg-muted/40"
                              loading="lazy"
                            />
                            <figcaption className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
                              <span>
                                {RATIO_LABELS[ratio]} · {IMAGE_SPECS[ratio].width}×
                                {IMAGE_SPECS[ratio].height}
                              </span>
                              <a
                                href={`${src}&download=1`}
                                className="inline-flex items-center gap-1 text-accent"
                              >
                                <Download size={12} /> İndir
                              </a>
                            </figcaption>
                          </figure>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-lg border border-border-soft bg-panel shadow-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">İlerleme</h3>
            <span className="text-xs text-muted-foreground">
              {done}/{steps.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-accent transition-[width] duration-500"
              style={{ width: `${steps.length ? Math.round((done / steps.length) * 100) : 0}%` }}
            />
          </div>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {kit.sections.map((s) => (
              <div key={s.id}>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {s.title}
                </div>
                <div className="mt-1 space-y-1.5">
                  {s.steps.map((st) => (
                    <StepCheckbox
                      key={st.id}
                      kitId={kitId}
                      stepId={st.id}
                      checked={Boolean(checklist[st.id])}
                      text={st.text}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {kit.gaps.length > 0 ? (
          <div className="rounded-lg border border-destructive/40 bg-panel p-4">
            <h3 className="inline-flex items-center gap-1.5 text-sm font-medium">
              <AlertTriangle size={14} className="text-destructive" />
              Senin belirleyeceklerin ({kit.gaps.length})
            </h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
              {kit.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-lg border border-border-soft bg-panel shadow-card p-4">
          <h3 className="text-sm font-medium">Senin girdilerin</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Hesabına ait bilgiler; kaydedince ilgili alanlar dolar, eksikler
            listesinden düşer.
          </p>
          <div className="mt-3">
            <KitInputsForm kitId={kitId} inputs={kit.inputs} />
          </div>
        </div>

        <div className="rounded-lg border border-border-soft bg-panel shadow-card p-4">
          <h3 className="text-sm font-medium">Dışa aktar</h3>
          <div className="mt-2 flex flex-col gap-1.5 text-xs">
            <a href={`${exportBase}?format=json`} className="inline-flex items-center gap-1.5 text-accent">
              <Download size={12} /> JSON
            </a>
            <a
              href={`${exportBase}?format=html`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 text-accent"
            >
              <ExternalLink size={12} /> Yazdırılabilir sayfa (PDF olarak kaydet)
            </a>
            <a href={`${exportBase}?format=sheet`} className="inline-flex items-center gap-1.5 text-accent">
              <Download size={12} /> Ads Manager içe aktarma CSV&apos;si
            </a>
            <p className="text-muted-foreground">
              CSV sütunları Meta&apos;nın dokümante ettiği şablon sütunlarıdır;
              şablon dosyası giriş gerektirdiğinden birebir doğrulanamadı.
              Kampanya/reklam seti &quot;Paused&quot;, reklam &quot;Off&quot; gelir —
              içe aktarım harcama başlatmaz. Belirlenemeyen zorunlu sütunlar
              (Optimization Goal, Billing Event, Link Object ID) boştur;
              hata alırsan Ads Manager&apos;ın &quot;View errors in Excel&quot;
              çıktısına bak.
            </p>
          </div>
        </div>

        <div
          id="published"
          className={cn(
            "rounded-lg border bg-panel p-4",
            publishedAt ? "border-accent/40" : "border-border-soft",
          )}
        >
          <h3 className="text-sm font-medium">
            {publishedAt ? "Ads Manager'da yayınlandı" : "Yayınladıktan sonra"}
          </h3>
          {publishedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(publishedAt).toLocaleString("tr-TR")}
              {publishNote ? ` · ${publishNote}` : ""}
            </p>
          ) : null}
          <div className="mt-3">
            <PublishedForm
              planId={planId}
              publishedAt={publishedAt}
              publishNote={publishNote}
            />
          </div>
          {publishedAt ? (
            <Link
              href={`/app/brands/${brandId}/campaigns#results-${planId}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent"
            >
              Sonuç gir → (Ads Manager raporu / CSV)
            </Link>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
