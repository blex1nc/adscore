"use client";

import { useActionState } from "react";
import {
  addCompetitor,
  addCompetitorAd,
  startPatternAnalysis,
  type CompetitorFormState,
} from "@/actions/competitors";
import {
  Button,
  FieldError,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import { COMPETITOR_TYPE_LABELS } from "@/lib/options";

export function AddCompetitorForm({ brandId }: { brandId: string }) {
  const action = addCompetitor.bind(null, brandId);
  const [state, formAction, pending] = useActionState<
    CompetitorFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="comp-name">Rakip adı</Label>
          <Input id="comp-name" name="name" required minLength={2} />
        </div>
        <div>
          <Label htmlFor="comp-type">Tip</Label>
          <Select id="comp-type" name="type" defaultValue="DIRECT">
            {Object.entries(COMPETITOR_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="comp-website">Website (opsiyonel)</Label>
          <Input
            id="comp-website"
            name="website"
            type="url"
            placeholder="https://..."
          />
        </div>
        <div>
          <Label htmlFor="comp-note">Not (opsiyonel)</Label>
          <Input id="comp-note" name="note" />
        </div>
      </div>
      <FieldError message={state.error} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Ekleniyor..." : "Rakip ekle"}
      </Button>
    </form>
  );
}

export function AddAdForm({ competitorId }: { competitorId: string }) {
  const action = addCompetitorAd.bind(null, competitorId);
  const [state, formAction, pending] = useActionState<
    CompetitorFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <div>
        <Label htmlFor={`ad-text-${competitorId}`}>
          Reklam metni veya tarifi
        </Label>
        <Textarea
          id={`ad-text-${competitorId}`}
          name="inputText"
          rows={3}
          required
          minLength={40}
          placeholder="Reklamın metnini yapıştır veya gördüğün reklamı tarif et (görsel, video akışı, teklif, CTA...)"
        />
      </div>
      <div>
        <Label htmlFor={`ad-url-${competitorId}`}>
          Reklam linki (opsiyonel, ör. Ad Library)
        </Label>
        <Input
          id={`ad-url-${competitorId}`}
          name="inputUrl"
          type="url"
          placeholder="https://www.facebook.com/ads/library/..."
        />
      </div>
      <FieldError message={state.error} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Ekleniyor..." : "Reklamı ekle ve analiz et"}
      </Button>
    </form>
  );
}

export function PatternStartForm({
  brandId,
  disabled,
  disabledReason,
}: {
  brandId: string;
  disabled: boolean;
  disabledReason?: string;
}) {
  const action = startPatternAnalysis.bind(null, brandId);
  const [state, formAction, pending] = useActionState<
    CompetitorFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction}>
      <Button
        type="submit"
        size="sm"
        disabled={pending || disabled}
        title={disabled ? disabledReason : undefined}
      >
        {pending ? "Başlatılıyor..." : "Pattern analizini başlat"}
      </Button>
      <FieldError message={state.error} />
    </form>
  );
}

export function AddCandidateButton({
  brandId,
  name,
  type,
  reason,
}: {
  brandId: string;
  name: string;
  type: string;
  reason?: string;
}) {
  const action = addCompetitor.bind(null, brandId);
  const [state, formAction, pending] = useActionState<
    CompetitorFormState,
    FormData
  >(action, {});

  const normalizedType = ["DIRECT", "INDIRECT", "ASPIRATIONAL", "CREATIVE"].includes(
    type?.toUpperCase?.() ?? "",
  )
    ? type.toUpperCase()
    : "DIRECT";

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="type" value={normalizedType} />
      <input type="hidden" name="note" value={reason ?? ""} />
      <input type="hidden" name="addedFrom" value="research" />
      <button
        type="submit"
        disabled={pending || state.success}
        className="text-xs text-accent transition-opacity duration-300 hover:opacity-80 disabled:opacity-50"
      >
        {state.success ? "Eklendi ✓" : pending ? "Ekleniyor..." : "Rakip olarak ekle"}
      </button>
      {state.error ? (
        <span className="ml-2 text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
