"use client";

import { useActionState } from "react";
import { createFirstAdmin, type AuthFormState } from "@/actions/auth";
import { Button, FieldError, Input, Label } from "@/components/ui";

export function SetupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    createFirstAdmin,
    {},
  );

  return (
    <form action={action} className="mt-5 space-y-4">
      <div>
        <Label htmlFor="name">İsim</Label>
        <Input id="name" name="name" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">E-posta</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <Label htmlFor="password">Şifre</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">En az 10 karakter.</p>
      </div>
      <FieldError message={state.error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Oluşturuluyor..." : "Yönetici hesabını oluştur"}
      </Button>
    </form>
  );
}
