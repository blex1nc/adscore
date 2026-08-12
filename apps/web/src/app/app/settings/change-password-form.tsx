"use client";

import { useActionState } from "react";
import { changePassword, type AuthFormState } from "@/actions/auth";
import { Button, FieldError, Input, Label } from "@/components/ui";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<
    AuthFormState & { success?: boolean },
    FormData
  >(changePassword, {});

  return (
    <form action={action} className="mt-4 max-w-sm space-y-4">
      <div>
        <Label htmlFor="currentPassword">Mevcut şifre</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <Label htmlFor="newPassword">Yeni şifre</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">En az 10 karakter.</p>
      </div>
      <FieldError message={state.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Kaydediliyor..." : "Şifreyi değiştir"}
        </Button>
        {state.success && !pending ? (
          <span className="text-sm text-muted-foreground">Değiştirildi.</span>
        ) : null}
      </div>
    </form>
  );
}
