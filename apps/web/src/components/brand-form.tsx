"use client";

import { useActionState } from "react";
import type { BrandFormState } from "@/actions/brands";
import {
  Button,
  FieldError,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import { COPY_LANGUAGES, CURRENCIES, MARKETS } from "@/lib/options";

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
