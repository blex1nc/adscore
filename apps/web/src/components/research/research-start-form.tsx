"use client";

import { useActionState } from "react";
import { startResearch, type ResearchActionState } from "@/actions/research";
import { Button, FieldError } from "@/components/ui";

export function ResearchStartForm({
  brandId,
  hasActiveRun,
  isRerun,
}: {
  brandId: string;
  hasActiveRun: boolean;
  isRerun: boolean;
}) {
  const action = startResearch.bind(null, brandId);
  const [state, formAction, pending] = useActionState<
    ResearchActionState,
    FormData
  >(action, {});

  return (
    <form action={formAction}>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || hasActiveRun}>
          {hasActiveRun
            ? "Araştırma sürüyor..."
            : pending
              ? "Başlatılıyor..."
              : isRerun
                ? "Yeniden araştır"
                : "Araştırmayı başlat"}
        </Button>
      </div>
      <FieldError message={state.error} />
    </form>
  );
}
