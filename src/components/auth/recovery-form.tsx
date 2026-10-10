"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordRecovery, updateRecoveredPassword } from "@/lib/auth/recovery-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RecoveryForm({ reset = false }: { reset?: boolean }) {
  const [state, action, pending] = useActionState(reset ? updateRecoveredPassword : requestPasswordRecovery, {});
  return (
    <form action={action} className="grid gap-4">
      {reset ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              className="h-11"
            />
            <p className="text-sm text-muted-foreground">Use no mínimo 8 caracteres, com letras e números.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirme a nova senha</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              className="h-11"
            />
          </div>
        </>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
        </div>
      )}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm">
          {state.success}
        </p>
      ) : null}
      <Button disabled={pending} type="submit" className="h-12">
        {pending ? (reset ? "Salvando..." : "Enviando...") : reset ? "Salvar nova senha" : "Enviar link de recuperação"}
      </Button>
      <Link href="/login" className="text-sm underline underline-offset-4">
        Voltar para entrar
      </Link>
    </form>
  );
}
