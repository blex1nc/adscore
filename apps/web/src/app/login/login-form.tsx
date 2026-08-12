"use client";

import { useActionState } from "react";
import { login, type AuthFormState } from "@/actions/auth";
import { Button, FieldError, Input, Label } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    login,
    {},
  );

  return (
    <form action={action} className="mt-5 space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
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
          autoComplete="current-password"
          required
        />
      </div>
      <FieldError message={state.error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Giriş yapılıyor..." : "Giriş yap"}
      </Button>
    </form>
  );
}
