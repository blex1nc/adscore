"use client";

// C2 — Rakip kartındaki "Ad Library'de ara" bölümü.
// Kapsam dürüstlüğü: zorunlu not her zaman görünür; boş sonuç asla
// "rakip reklam vermiyor" gibi sunulmaz (AGENT-C.md Mutlak Kurallar).

import { useActionState } from "react";
import { searchAdLibrary, type LibrarySearchState } from "@/actions/meta-library";
import {
  AD_LIBRARY_SCOPE_NOTE,
  isEuCovered,
  NON_EU_SCOPE_WARNING,
} from "@/lib/meta-library/archive";
import { Button, Input, Label, Select } from "@/components/ui";

import { COUNTRY_OPTIONS } from "@/components/library/country-options";

export function AdLibrarySearch({
  competitorId,
  competitorName,
  targetMarket,
}: {
  competitorId: string;
  competitorName: string;
  targetMarket: string | null;
}) {
  const action = searchAdLibrary.bind(null, competitorId);
  const [state, formAction, pending] = useActionState<LibrarySearchState, FormData>(
    action,
    {},
  );
  const defaultCountry =
    targetMarket && COUNTRY_OPTIONS.some(([c]) => c === targetMarket.toUpperCase())
      ? targetMarket.toUpperCase()
      : "TR";

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
      <h4 className="text-sm font-medium">Ad Library&apos;de ara</h4>
      <p className="mt-1 text-xs text-muted-foreground">{AD_LIBRARY_SCOPE_NOTE}</p>
      {!isEuCovered(defaultCountry) ? (
        <p className="mt-1 text-xs text-muted-foreground">{NON_EU_SCOPE_WARNING}</p>
      ) : null}

      <form action={formAction} className="mt-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Label htmlFor={`al-q-${competitorId}`}>Arama terimi</Label>
            <Input
              id={`al-q-${competitorId}`}
              name="searchTerms"
              defaultValue={competitorName}
              maxLength={100}
              required
            />
          </div>
          <div>
            <Label htmlFor={`al-c-${competitorId}`}>Pazar</Label>
            <Select
              id={`al-c-${competitorId}`}
              name="country"
              defaultValue={defaultCountry}
            >
              {COUNTRY_OPTIONS.map(([code, label]) => (
                <option key={code} value={code}>
                  {code} — {label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Aranıyor..." : "Ad Library'de ara"}
          </Button>
        </div>

        {state.blocked ? (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
            <span className="mr-2 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide">
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
        {state.summary ? (
          <div
            className={
              state.emptyResult
                ? "rounded-md border border-border p-3 text-xs text-muted-foreground"
                : "rounded-md border border-accent/40 p-3 text-xs"
            }
          >
            {state.summary}
            {state.scopeWarning ? (
              <p className="mt-2 text-muted-foreground">{state.scopeWarning}</p>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
