"use client";

// Küçük yardımcı: MetaActionState dönen server action'ı buton olarak çalıştırır,
// pending durumunu ve dönen mesajı gösterir (A5 ekranı).
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import type { MetaActionState } from "@/actions/meta";

export function MetaActionButton({
  label,
  pendingLabel,
  action,
  variant = "secondary",
  confirm,
}: {
  label: string;
  pendingLabel: string;
  action: () => Promise<MetaActionState>;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  confirm?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<MetaActionState | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => {
            setState(await action());
          });
        }}
      >
        {pending ? pendingLabel : label}
      </Button>
      {state?.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="text-xs text-muted-foreground">{state.success}</p>
      ) : null}
    </div>
  );
}
