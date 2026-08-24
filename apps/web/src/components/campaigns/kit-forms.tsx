"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";
import {
  buildPublishKit,
  markPlanPublished,
  toggleKitStep,
  updateKitInputs,
  type KitFormState,
} from "@/actions/publish-kit";
import { Button, FieldError, Input, Label } from "@/components/ui";
import type { KitInputs } from "@/lib/publish-kit/types";

export function BuildKitButton({
  planId,
  disabled,
  hasKit,
  reason,
}: {
  planId: string;
  disabled: boolean;
  hasKit: boolean;
  reason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant={hasKit ? "secondary" : "primary"}
        disabled={disabled || pending}
        title={reason}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await buildPublishKit(planId);
            if (res.error) setError(res.error);
            else router.refresh();
          })
        }
      >
        <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
        {pending ? "Üretiliyor..." : hasKit ? "Yeni sürüm üret" : "Kiti üret"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
      {reason && disabled ? (
        <span className="text-xs text-muted-foreground">{reason}</span>
      ) : null}
    </div>
  );
}

// Checklist adımı: sunucu durumu + iyimser görünüm (revalidate gelince sunucu değeri kazanır)
export function StepCheckbox({
  kitId,
  stepId,
  checked,
  text,
}: {
  kitId: string;
  stepId: string;
  checked: boolean;
  text: string;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(checked);
  return (
    <div className="flex items-start gap-2">
      <input
        type="checkbox"
        id={`step-${stepId}`}
        checked={optimistic}
        disabled={pending}
        onChange={(e) => {
          const next = e.currentTarget.checked;
          startTransition(async () => {
            setOptimistic(next);
            const fd = new FormData();
            fd.set("kitId", kitId);
            fd.set("stepId", stepId);
            fd.set("checked", String(next));
            await toggleKitStep(fd);
          });
        }}
        className="mt-0.5 size-4 shrink-0 accent-(--accent)"
      />
      <label
        htmlFor={`step-${stepId}`}
        className={
          optimistic ? "text-sm text-muted-foreground line-through" : "text-sm"
        }
      >
        {text}
      </label>
    </div>
  );
}

const INPUT_FIELDS: Array<{
  key: keyof KitInputs;
  label: string;
  placeholder: string;
  type?: string;
}> = [
  { key: "facebookPage", label: "Facebook Sayfası", placeholder: "Sayfa adı" },
  { key: "instagramAccount", label: "Instagram hesabı (ops.)", placeholder: "@hesap" },
  {
    key: "destinationUrl",
    label: "Hedef URL",
    placeholder: "https://...",
    type: "url",
  },
  { key: "pixelDataset", label: "Pixel / veri seti", placeholder: "Events Manager'daki ad" },
  {
    key: "conversionEvent",
    label: "Dönüşüm event'i",
    placeholder: "ör. Purchase",
  },
  {
    key: "adsManagerCampaignName",
    label: "Ads Manager kampanya adı (farklıysa)",
    placeholder: "boş bırak = plandaki ad",
  },
];

export function KitInputsForm({
  kitId,
  inputs,
}: {
  kitId: string;
  inputs: KitInputs;
}) {
  const action = updateKitInputs.bind(null, kitId);
  const [state, formAction, pending] = useActionState<KitFormState, FormData>(
    action,
    {},
  );
  return (
    <form action={formAction} className="space-y-3">
      {INPUT_FIELDS.map((f) => (
        <div key={f.key}>
          <Label htmlFor={`in-${f.key}`} className="text-xs">
            {f.label}
          </Label>
          <Input
            id={`in-${f.key}`}
            name={f.key}
            type={f.type ?? "text"}
            defaultValue={inputs[f.key] ?? ""}
            placeholder={f.placeholder}
            className="py-1.5 text-xs"
          />
        </div>
      ))}
      <FieldError message={state.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Kaydediliyor..." : "Girdileri kaydet"}
        </Button>
        {state.success ? (
          <span className="inline-flex items-center gap-1 text-xs text-accent">
            <Check size={12} /> Kaydedildi, kit güncellendi
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function PublishedForm({
  planId,
  publishedAt,
  publishNote,
}: {
  planId: string;
  publishedAt: string | null;
  publishNote: string | null;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          await markPlanPublished(fd);
        });
      }}
      className="space-y-2"
    >
      <input type="hidden" name="planId" value={planId} />
      <Label htmlFor="publishNote" className="text-xs">
        Not (ops.) — ör. Ads Manager kampanya adı / ID
      </Label>
      <Input
        id="publishNote"
        name="publishNote"
        defaultValue={publishNote ?? ""}
        placeholder="Ads Manager'daki kampanya adı veya ID"
        className="py-1.5 text-xs"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending
          ? "Kaydediliyor..."
          : publishedAt
            ? "Yayın notunu güncelle"
            : "Ads Manager'da yayınladım"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Bu işaret yalnız kaydı tutar; panel Meta&apos;ya bağlı değildir, hiçbir şey
        otomatik yayınlanmaz.
      </p>
    </form>
  );
}
