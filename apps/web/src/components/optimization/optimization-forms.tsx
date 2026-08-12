"use client";

import { useActionState } from "react";
import {
  decideRecommendation,
  startOptimizationRun,
  type OptimizationFormState,
} from "@/actions/optimization";
import { Button, FieldError } from "@/components/ui";

export function StartOptimizationForm({
  brandId,
  hasActive,
}: {
  brandId: string;
  hasActive: boolean;
}) {
  const action = startOptimizationRun.bind(null, brandId);
  const [state, formAction, pending] = useActionState<
    OptimizationFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="mt-3">
      <Button type="submit" size="sm" disabled={pending || hasActive}>
        {pending || hasActive
          ? "Analiz sürüyor..."
          : "Optimizasyon analizini başlat"}
      </Button>
      <FieldError message={state.error} />
    </form>
  );
}

function DecideButton({
  recommendationId,
  decision,
  label,
  className,
}: {
  recommendationId: string;
  decision: "ACCEPTED" | "DISMISSED";
  label: string;
  className: string;
}) {
  const action = decideRecommendation.bind(null, recommendationId, decision);
  const [state, formAction, pending] = useActionState<
    OptimizationFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="inline">
      <button type="submit" disabled={pending} className={className}>
        {pending ? "..." : label}
      </button>
      {state.error ? (
        <span className="ml-2 text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}

export function DecideButtons({
  recommendationId,
}: {
  recommendationId: string;
}) {
  return (
    <span className="flex shrink-0 items-center gap-3">
      <DecideButton
        recommendationId={recommendationId}
        decision="ACCEPTED"
        label="Kabul et"
        className="text-xs text-accent transition-opacity duration-300 hover:opacity-80 disabled:opacity-50"
      />
      <DecideButton
        recommendationId={recommendationId}
        decision="DISMISSED"
        label="Reddet"
        className="text-xs text-muted-foreground transition-colors duration-300 hover:text-foreground disabled:opacity-50"
      />
    </span>
  );
}
