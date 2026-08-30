"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  BrandAssetFormState,
  BrandFormState,
  BrandProduct,
} from "@/actions/brands";
import {
  Button,
  FieldError,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import { COPY_LANGUAGES, CURRENCIES, MARKETS } from "@/lib/options";
import {
  ASSET_KINDS,
  ASSET_MAX_BYTES,
  ASSET_MIME_TYPES,
  PRODUCT_LIMIT,
  PROFILE_TEXT_LIMIT,
} from "@/components/launch/brand-profile-limits";

type BrandValues = {
  name?: string;
  website?: string | null;
  description?: string | null;
  targetMarket?: string | null;
  currency?: string | null;
  copyLanguage?: string | null;
};

export function BrandForm({
  action,
  initial,
  submitLabel,
  successMessage,
}: {
  action: (prev: BrandFormState, formData: FormData) => Promise<BrandFormState>;
  initial?: BrandValues;
  submitLabel: string;
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState<BrandFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Marka adı</Label>
        <Input
          id="name"
          name="name"
          defaultValue={initial?.name ?? ""}
          required
          minLength={2}
        />
      </div>
      <div>
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          name="website"
          type="url"
          placeholder="https://..."
          defaultValue={initial?.website ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="description">Açıklama</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Ne satıyor, kime satıyor?"
          defaultValue={initial?.description ?? ""}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="targetMarket">Hedef pazar</Label>
          <Select
            id="targetMarket"
            name="targetMarket"
            defaultValue={initial?.targetMarket ?? ""}
          >
            <option value="">Seçilmedi</option>
            {MARKETS.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="currency">Para birimi</Label>
          <Select
            id="currency"
            name="currency"
            defaultValue={initial?.currency ?? ""}
          >
            <option value="">Seçilmedi</option>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="copyLanguage">Reklam dili</Label>
          <Select
            id="copyLanguage"
            name="copyLanguage"
            defaultValue={initial?.copyLanguage ?? ""}
          >
            <option value="">Seçilmedi</option>
            {COPY_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <FieldError message={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Kaydediliyor..." : submitLabel}
      </Button>
      {state.success && !pending ? (
        <span className="ml-3 text-sm text-muted-foreground">
          {successMessage ?? "Kaydedildi."}
        </span>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Marka profili zenginleştirme (AGENT-C §2): ses, ayrıştırıcı değer, ürünler.
// Fiyat alanı serbest metindir ve yalnız kullanıcı doldurur; sistem üretmez.
// ---------------------------------------------------------------------------

type ProductRow = BrandProduct & { key: number };

function toRows(products: BrandProduct[] | null | undefined): ProductRow[] {
  return (products ?? []).map((p, i) => ({ ...p, key: i }));
}

export function BrandProfileForm({
  action,
  initial,
}: {
  action: (prev: BrandFormState, formData: FormData) => Promise<BrandFormState>;
  initial: {
    brandVoice?: string | null;
    usp?: string | null;
    products?: BrandProduct[] | null;
  };
}) {
  const [state, formAction, pending] = useActionState<BrandFormState, FormData>(
    action,
    {},
  );
  const [rows, setRows] = useState<ProductRow[]>(() => toRows(initial.products));
  const [nextKey, setNextKey] = useState(() => rows.length);

  function addRow() {
    if (rows.length >= PRODUCT_LIMIT) return;
    setRows([...rows, { key: nextKey, name: "" }]);
    setNextKey(nextKey + 1);
  }
  function updateRow(key: number, patch: Partial<BrandProduct>) {
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: number) {
    setRows(rows.filter((r) => r.key !== key));
  }

  // Sunucuya JSON olarak gider; boş satırlar (adsız) gönderilmez
  const productsJson = JSON.stringify(
    rows
      .filter((r) => r.name.trim() !== "")
      .map((r) => ({
        name: r.name,
        price: r.price,
        url: r.url,
        description: r.description,
      })),
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="products" value={productsJson} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="brandVoice">Marka sesi</Label>
          <Textarea
            id="brandVoice"
            name="brandVoice"
            rows={3}
            maxLength={PROFILE_TEXT_LIMIT}
            placeholder='Ör. "Samimi, doğrudan, şaka yapmaz; sen diye hitap eder."'
            defaultValue={initial.brandVoice ?? ""}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Copy üretiminde ton referansı. En fazla {PROFILE_TEXT_LIMIT} karakter.
          </p>
        </div>
        <div>
          <Label htmlFor="usp">Ayrıştırıcı değer (USP)</Label>
          <Textarea
            id="usp"
            name="usp"
            rows={3}
            maxLength={PROFILE_TEXT_LIMIT}
            placeholder="Rakiplerden farkın tek cümleyle ne?"
            defaultValue={initial.usp ?? ""}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Açıklama yoksa launch için bu alan yeterli sayılır.
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="mb-0">Ürünler</Label>
          <span className="text-xs text-muted-foreground">
            {rows.length} / {PRODUCT_LIMIT}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Fiyatı sen girersin; sistem fiyat veya indirim üretmez. Boş bırakılan
          fiyat copy&apos;de kullanılmaz.
        </p>
        {rows.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {rows.map((row) => (
              <li
                key={row.key}
                className="grid gap-2 rounded-md border border-border-soft p-3 sm:grid-cols-[1.2fr_0.7fr_1fr_auto]"
              >
                <Input
                  aria-label="Ürün adı"
                  placeholder="Ürün adı"
                  value={row.name}
                  maxLength={120}
                  onChange={(e) => updateRow(row.key, { name: e.target.value })}
                  required
                />
                <Input
                  aria-label="Fiyat"
                  placeholder="Fiyat (ör. 349 TL)"
                  value={row.price ?? ""}
                  maxLength={40}
                  onChange={(e) => updateRow(row.key, { price: e.target.value })}
                />
                <Input
                  aria-label="Ürün URL"
                  placeholder="https://..."
                  type="url"
                  value={row.url ?? ""}
                  onChange={(e) => updateRow(row.key, { url: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  aria-label="Ürünü sil"
                  className="inline-flex items-center justify-center rounded-md border border-border-soft px-2 text-muted-foreground transition-colors duration-300 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
                <Input
                  aria-label="Ürün açıklaması"
                  placeholder="Kısa açıklama (opsiyonel)"
                  value={row.description ?? ""}
                  maxLength={300}
                  onChange={(e) =>
                    updateRow(row.key, { description: e.target.value })
                  }
                  className="sm:col-span-4"
                />
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= PRODUCT_LIMIT}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent transition-opacity duration-300 hover:opacity-80 disabled:opacity-50"
        >
          <Plus size={13} />
          Ürün satırı ekle
        </button>
      </div>

      <FieldError message={state.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor..." : "Profili kaydet"}
        </Button>
        {state.success && !pending ? (
          <span className="text-sm text-muted-foreground">Kaydedildi.</span>
        ) : null}
      </div>
    </form>
  );
}

// Logo / ürün görseli yükleme: ≤2 MB, yalnız PNG/JPEG/WebP. SVG kabul edilmez.
export function BrandAssetUploadForm({
  action,
  defaultKind = "LOGO",
}: {
  action: (
    prev: BrandAssetFormState,
    formData: FormData,
  ) => Promise<BrandAssetFormState>;
  defaultKind?: (typeof ASSET_KINDS)[number]["value"];
}) {
  const [state, formAction, pending] = useActionState<
    BrandAssetFormState,
    FormData
  >(action, {});
  const [clientError, setClientError] = useState<string | null>(null);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        // Sunucu doğrulaması asıl kapıdır; bu yalnız erken geri bildirim
        const input = e.currentTarget.elements.namedItem(
          "file",
        ) as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (file && file.size > ASSET_MAX_BYTES) {
          e.preventDefault();
          setClientError("Dosya 2 MB sınırını aşıyor.");
          return;
        }
        setClientError(null);
      }}
    >
      <div>
        <Label htmlFor="asset-kind">Tür</Label>
        <Select id="asset-kind" name="kind" defaultValue={defaultKind}>
          {ASSET_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="asset-file">Görsel (PNG/JPEG/WebP, ≤2 MB)</Label>
        <input
          id="asset-file"
          name="file"
          type="file"
          accept={ASSET_MIME_TYPES.join(",")}
          required
          className="block text-sm file:mr-3 file:rounded-full file:border file:border-border-soft file:bg-panel file:px-3 file:py-1.5 file:text-xs file:font-medium"
        />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Yükleniyor..." : "Yükle"}
      </Button>
      <FieldError message={clientError ?? state.error} />
      {state.success && !pending && !clientError ? (
        <span className="text-xs text-muted-foreground">Yüklendi.</span>
      ) : null}
    </form>
  );
}
