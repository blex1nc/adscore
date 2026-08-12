"use client";

import { useActionState } from "react";
import { createInvite, type InviteFormState } from "@/actions/admin";
import { Button, FieldError, Input, Label } from "@/components/ui";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteFormState, FormData>(
    createInvite,
    {},
  );

  return (
    <form action={action} className="mt-4 flex max-w-md items-end gap-3">
      <div className="flex-1">
        <Label htmlFor="email">E-posta (opsiyonel)</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="Boş bırakılırsa link herkese açık olur"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Oluşturuluyor..." : "Davet oluştur"}
      </Button>
      <FieldError message={state.error} />
    </form>
  );
}
