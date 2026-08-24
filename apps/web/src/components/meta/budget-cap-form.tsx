"use client";

// Workspace günlük bütçe tavanı (CLAUDE.md §23) — kullanıcı belirler, guard'lar zorlar.
import { useActionState } from "react";
import { setMaxDailyBudget, type MetaActionState } from "@/actions/meta";
import { Button, Input } from "@/components/ui";

const initial: MetaActionState = {};

export function BudgetCapForm({ current }: { current: string | null }) {
  const [state, formAction, pending] = useActionState(
    setMaxDailyBudget,
    initial,
  );

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="w-44">
        <label
          htmlFor="maxDailyBudget"
          className="mb-1 block text-xs text-muted-foreground"
        >
          Günlük tavan (ad account para biriminde)
        </label>
        <Input
          id="maxDailyBudget"
          name="maxDailyBudget"
          inputMode="decimal"
          defaultValue={current ?? ""}
          placeholder="ör. 500"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </Button>
      <div className="w-full text-xs">
        {state.error ? <p className="text-destructive">{state.error}</p> : null}
        {state.success ? (
          <p className="text-muted-foreground">{state.success}</p>
        ) : null}
      </div>
    </form>
  );
}
