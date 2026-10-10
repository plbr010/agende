"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/usability/password-field";

const initial: ActionState = {};

export function LoginForm({ next }: { next?: string | null }) {
  const [state, action, pending] = useActionState(signInAction, initial);

  return (
    <form action={action} className="grid gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
      </div>
      <PasswordField id="password" name="password" label="Senha" autoComplete="current-password" hint={null} />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Link href="/recuperar-senha" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">
        Esqueci a senha
      </Link>
      <Button type="submit" className="h-12" disabled={pending}>
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
