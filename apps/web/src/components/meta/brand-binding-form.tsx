"use client";

// A5 — Marka ↔ Meta varlık bağlama formu.
// Page/IG/pixel seçenekleri SAYFA AÇILIŞINDA değil, kullanıcı isteyince
// Meta'dan çekilir (rate limit dostu). Page zorunlu: yayın hattı Page olmadan çalışmaz.
import { useActionState, useState, useTransition } from "react";
import {
  bindBrandMeta,
  loadInstagramOption,
  loadPageOptions,
  loadPixelOptions,
  type MetaActionState,
  type MetaOption,
} from "@/actions/meta";
import { Button, Select } from "@/components/ui";

type AdAccountRow = {
  actId: string;
  name: string;
  currency: string;
};

type BindingSummary = {
  adAccountId: string;
  pageId: string;
  instagramActorId: string | null;
  pixelId: string | null;
} | null;

const initial: MetaActionState = {};

export function BrandBindingForm({
  brandId,
  brandName,
  adAccounts,
  binding,
}: {
  brandId: string;
  brandName: string;
  adAccounts: AdAccountRow[];
  binding: BindingSummary;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(bindBrandMeta, initial);

  const [adAccountId, setAdAccountId] = useState(binding?.adAccountId ?? "");
  const [pages, setPages] = useState<MetaOption[] | null>(null);
  const [pageId, setPageId] = useState(binding?.pageId ?? "");
  const [igOptions, setIgOptions] = useState<MetaOption[] | null>(null);
  const [pixels, setPixels] = useState<MetaOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const loadOptions = () => {
    setLoadError(null);
    startLoading(async () => {
      const pageRes = await loadPageOptions();
      if (pageRes.error && !pageRes.options) {
        setLoadError(pageRes.error);
        return;
      }
      setPages(pageRes.options ?? []);
      if (adAccountId) {
        const pixelRes = await loadPixelOptions(adAccountId);
        setPixels(pixelRes.options ?? []);
        if (pixelRes.error) setLoadError(pixelRes.error);
      }
    });
  };

  const loadIg = (selectedPage: string) => {
    setPageId(selectedPage);
    setIgOptions(null);
    if (!selectedPage) return;
    startLoading(async () => {
      const res = await loadInstagramOption(selectedPage);
      setIgOptions(res.options ?? []);
      if (res.error) setLoadError(res.error);
    });
  };

  const loadPixelsFor = (actId: string) => {
    setAdAccountId(actId);
    setPixels(null);
    if (!actId) return;
    startLoading(async () => {
      const res = await loadPixelOptions(actId);
      setPixels(res.options ?? []);
      if (res.error) setLoadError(res.error);
    });
  };

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">{brandName}</span>
          {binding ? (
            <span className="ml-2 text-xs text-muted-foreground">
              {binding.adAccountId} · Page {binding.pageId}
              {binding.instagramActorId ? " · IG bağlı" : ""}
              {binding.pixelId ? " · pixel bağlı" : ""}
            </span>
          ) : (
            <span className="ml-2 text-xs text-destructive">
              Bağlı değil — yayın hattı bu marka için kapalı
            </span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setOpen(true)}
        >
          {binding ? "Düzenle" : "Bağla"}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{brandName}</p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Kapat
        </Button>
      </div>

      {adAccounts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Önce yukarıdan ad account listesini yenile — bağlanacak hesap
          önbelleğe alınmamış.
        </p>
      ) : (
        <form action={formAction} className="mt-3 space-y-3">
          <input type="hidden" name="brandId" value={brandId} />

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Ad account (zorunlu)
            </label>
            <Select
              name="adAccountId"
              value={adAccountId}
              onChange={(e) => loadPixelsFor(e.target.value)}
              required
            >
              <option value="">Seç…</option>
              {adAccounts.map((a) => (
                <option key={a.actId} value={a.actId}>
                  {a.name} ({a.actId}, {a.currency})
                </option>
              ))}
            </Select>
          </div>

          {pages === null ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading}
              onClick={loadOptions}
            >
              {loading ? "Meta'dan getiriliyor…" : "Page / pixel seçeneklerini Meta'dan getir"}
            </Button>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Facebook Page (zorunlu — yayın hattı Page olmadan çalışmaz)
                </label>
                <Select
                  name="pageId"
                  value={pageId}
                  onChange={(e) => loadIg(e.target.value)}
                  required
                >
                  <option value="">Seç…</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
                {pages.length === 0 ? (
                  <p className="mt-1 text-xs text-destructive">
                    Erişilebilir Page bulunamadı. Page erişimi olmadan bu marka
                    için yayın hattı çalışmaz — Meta tarafında Page yetkisi
                    verilmiş bir hesapla yeniden bağlan.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Instagram Business hesabı (opsiyonel)
                </label>
                <Select name="instagramActorId" defaultValue={binding?.instagramActorId ?? ""}>
                  <option value="">Bağlama</option>
                  {(igOptions ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Pixel (opsiyonel)
                </label>
                <Select name="pixelId" defaultValue={binding?.pixelId ?? ""}>
                  <option value="">Bağlama</option>
                  {(pixels ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>

              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Kaydediliyor…" : "Bağla ve kaydet"}
              </Button>
            </>
          )}

          {loadError ? (
            <p className="text-xs text-destructive">{loadError}</p>
          ) : null}
          {state.error ? (
            <p className="text-xs text-destructive">{state.error}</p>
          ) : null}
          {state.success ? (
            <p className="text-xs text-muted-foreground">{state.success}</p>
          ) : null}
        </form>
      )}
    </div>
  );
}
