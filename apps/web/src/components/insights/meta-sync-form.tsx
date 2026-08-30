"use client";

// C1 — "Meta'dan sonuçları çek" formu. Kullanıcı tetikler (otomatik senkron yok).

import { useActionState } from "react";
import { syncMetaResults, type MetaSyncState } from "@/actions/meta-insights";
import { Button, Input, Label } from "@/components/ui";

export function MetaSyncForm({
  planId,
  defaultSince,
  defaultUntil,
}: {
  planId: string;
  defaultSince: string;
  defaultUntil: string;
}) {
  const action = syncMetaResults.bind(null, planId);
  const [state, formAction, pending] = useActionState<MetaSyncState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor={`ms-s-${planId}`}>Başlangıç</Label>
          <Input
            id={`ms-s-${planId}`}
            name="since"
            type="date"
            defaultValue={defaultSince}
            required
          />
        </div>
        <div>
          <Label htmlFor={`ms-u-${planId}`}>Bitiş</Label>
          <Input
            id={`ms-u-${planId}`}
            name="until"
            type="date"
            defaultValue={defaultUntil}
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Çekiliyor..." : "Meta'dan sonuçları çek"}
        </Button>
      </div>

      {state.blocked ? (
        <div className="rounded-md border border-border-soft bg-muted/40 p-3 text-xs">
          <span className="mr-2 rounded-full border border-border-soft px-2 py-0.5 text-[10px] uppercase tracking-wide">
            BLOCKED
          </span>
          {state.blocked}
        </div>
      ) : null}
      {state.error ? (
        <div className="rounded-md border border-destructive/40 p-3 text-xs">
          {state.error}
        </div>
      ) : null}
      {state.synced ? (
        <div className="rounded-md border border-accent/40 p-3 text-xs">
          {state.updated
            ? "Bu dönemin Meta sonucu güncellendi (aynı dönem için yeni satır açılmadı)."
            : "Meta sonucu kaydedildi."}{" "}
          Sayılar aşağıdaki sonuç listesinde &quot;Meta API&quot; rozetiyle görünür.
          {state.warnings?.length ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
              {state.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
