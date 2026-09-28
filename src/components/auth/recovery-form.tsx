"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordRecovery, updateRecoveredPassword } from "@/lib/auth/recovery-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RecoveryForm({ reset = false }: { reset?: boolean }) {
  const [state, action, pending] = useActionState(reset ? updateRecoveredPassword : requestPasswordRecovery, {});
  return <form action={action} className="grid gap-4">
    {reset ? <>
      <Label htmlFor="password">Nova senha (mínimo de 8 caracteres, letras e números)</Label>
      <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
      <Label htmlFor="confirmPassword">Confirme a nova senha</Label>
      <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
    </> : <><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="email" required /></>}
    {state.error && <p role="alert" className="text-destructive">{state.error}</p>}
    {state.success && <p role="status">{state.success}</p>}
    <Button disabled={pending} type="submit">{pending ? "Aguarde..." : reset ? "Salvar nova senha" : "Enviar link de recuperação"}</Button>
    <Link href="/login" className="underline">Voltar para entrar</Link>
  </form>;
}
