"use client";

import { useActionState } from "react";
import {
  startCreativeGeneration,
  updateCreative,
  type CreativeFormState,
} from "@/actions/creatives";
import {
  Button,
  FieldError,
  Input,
  Label,
  Textarea,
} from "@/components/ui";

export function GenerateForm({
  brandId,
  hasActive,
}: {
  brandId: string;
  hasActive: boolean;
}) {
  const action = startCreativeGeneration.bind(null, brandId);
  const [state, formAction, pending] = useActionState<
    CreativeFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="offer">Gerçek teklif (opsiyonel)</Label>
          <Input
            id="offer"
            name="offer"
            placeholder='Ör. "İlk siparişe kargo bedava"'
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Boş bırakılırsa copy'de hiçbir indirim/kampanya vaadi kullanılmaz.
            Sistem teklif uydurmaz.
          </p>
        </div>
        <div>
          <Label htmlFor="instruction">Yönlendirme (opsiyonel)</Label>
          <Input
            id="instruction"
            name="instruction"
            placeholder='Ör. "Abonelik modelini öne çıkar"'
          />
        </div>
      </div>
      <FieldError message={state.error} />
      <Button type="submit" size="sm" disabled={pending || hasActive}>
        {hasActive
          ? "Üretim sürüyor..."
          : pending
            ? "Başlatılıyor..."
            : "3 varyant üret"}
      </Button>
    </form>
  );
}

export function EditCreativeForm({
  creativeId,
  initial,
}: {
  creativeId: string;
  initial: {
    primaryText: string;
    headline: string;
    description: string | null;
    cta: string;
  };
}) {
  const action = updateCreative.bind(null, creativeId);
  const [state, formAction, pending] = useActionState<
    CreativeFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <div>
        <Label htmlFor={`pt-${creativeId}`}>Primary text</Label>
        <Textarea
          id={`pt-${creativeId}`}
          name="primaryText"
          rows={3}
          defaultValue={initial.primaryText}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`hl-${creativeId}`}>Başlık</Label>
          <Input
            id={`hl-${creativeId}`}
            name="headline"
            defaultValue={initial.headline}
            required
          />
        </div>
        <div>
          <Label htmlFor={`ds-${creativeId}`}>Açıklama</Label>
          <Input
            id={`ds-${creativeId}`}
            name="description"
            defaultValue={initial.description ?? ""}
          />
        </div>
        <div>
          <Label htmlFor={`cta-${creativeId}`}>CTA</Label>
          <Input
            id={`cta-${creativeId}`}
            name="cta"
            defaultValue={initial.cta}
            required
          />
        </div>
      </div>
      <FieldError message={state.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Kaydediliyor..." : "Düzenlemeyi kaydet"}
        </Button>
        {state.success && !pending ? (
          <span className="text-xs text-muted-foreground">
            Kaydedildi; yeniden onaya düştü.
          </span>
        ) : null}
      </div>
    </form>
  );
}
