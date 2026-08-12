"use client";

import { useActionState } from "react";
import {
  addCampaignResult,
  startResultAnalysis,
  type ResultFormState,
} from "@/actions/results";
import { Button, FieldError, Input, Label } from "@/components/ui";

export function AddResultForm({ planId }: { planId: string }) {
  const action = addCampaignResult.bind(null, planId);
  const [state, formAction, pending] = useActionState<
    ResultFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor={`ps-${planId}`}>Başlangıç</Label>
          <Input id={`ps-${planId}`} name="periodStart" type="date" required />
        </div>
        <div>
          <Label htmlFor={`pe-${planId}`}>Bitiş</Label>
          <Input id={`pe-${planId}`} name="periodEnd" type="date" required />
        </div>
        <div>
          <Label htmlFor={`sp-${planId}`}>Harcama</Label>
          <Input
            id={`sp-${planId}`}
            name="spend"
            type="number"
            min="0"
            step="0.01"
            required
          />
        </div>
        <div>
          <Label htmlFor={`im-${planId}`}>Gösterim</Label>
          <Input
            id={`im-${planId}`}
            name="impressions"
            type="number"
            min="0"
            required
          />
        </div>
        <div>
          <Label htmlFor={`cl-${planId}`}>Tıklama</Label>
          <Input
            id={`cl-${planId}`}
            name="clicks"
            type="number"
            min="0"
            required
          />
        </div>
        <div>
          <Label htmlFor={`re-${planId}`}>Erişim (ops.)</Label>
          <Input id={`re-${planId}`} name="reach" type="number" min="0" />
        </div>
        <div>
          <Label htmlFor={`pu-${planId}`}>Satın alma (ops.)</Label>
          <Input id={`pu-${planId}`} name="purchases" type="number" min="0" />
        </div>
        <div>
          <Label htmlFor={`rv-${planId}`}>Ciro (ops.)</Label>
          <Input
            id={`rv-${planId}`}
            name="revenue"
            type="number"
            min="0"
            step="0.01"
          />
        </div>
      </div>
      <FieldError message={state.error} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Kaydediliyor..." : "Sonucu kaydet"}
      </Button>
    </form>
  );
}

export function AnalyzeButton({
  resultId,
  disabled,
}: {
  resultId: string;
  disabled: boolean;
}) {
  const action = startResultAnalysis.bind(null, resultId);
  const [state, formAction, pending] = useActionState<
    ResultFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={pending || disabled}
        className="text-xs text-accent transition-opacity duration-300 hover:opacity-80 disabled:opacity-50"
      >
        {pending ? "Başlatılıyor..." : "AI ile analiz et"}
      </button>
      {state.error ? (
        <span className="ml-2 text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
