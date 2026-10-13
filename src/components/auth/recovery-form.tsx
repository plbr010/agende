"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordRecovery, updateRecoveredPassword } from "@/lib/auth/recovery-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/usability/password-field";
import { PortugueseForm } from "@/components/usability/portuguese-form";

export function RecoveryForm({ reset = false }: { reset?: boolean }) {
  const [state, action, pending] = useActionState(reset ? updateRecoveredPassword : requestPasswordRecovery, {});
  return (
    <PortugueseForm action={action} className="grid gap-4">
      {reset ? (
        <>
          <PasswordField
            id="password"
            name="password"
            label="Nova senha"
            autoComplete="new-password"
          />
          <PasswordField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirme a nova senha"
            autoComplete="new-password"
            hint={null}
          />
        </>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
        </div>
      )}
      {state.error ? (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-2xl bg-metric-blush px-4 py-3 text-sm">
          {state.success}
        </p>
      ) : null}
      <Button disabled={pending} type="submit" className="h-12">
        {pending ? (reset ? "Salvando..." : "Enviando...") : reset ? "Salvar nova senha" : "Enviar link de recuperação"}
      </Button>
      <Link href="/login" className="text-sm underline underline-offset-4">
        Voltar para entrar
      </Link>
    </PortugueseForm>
  );
}
