"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/auth/actions";
import { updateClientProfileAction } from "@/lib/client/actions";
import { formatPhoneBr } from "@/lib/validation/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PortugueseForm } from "@/components/usability/portuguese-form";

const initial: ActionState = {};

export function ClientProfileForm({
  fullName,
  phone,
  email,
}: {
  fullName: string;
  phone: string | null;
  email: string;
}) {
  const [state, action, pending] = useActionState(updateClientProfileAction, initial);
  const [phoneValue, setPhoneValue] = useState(phone ? formatPhoneBr(phone) : "");

  return (
    <PortugueseForm action={action} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="fullName">Nome</Label>
        <Input id="fullName" name="fullName" defaultValue={fullName} autoComplete="name" required className="h-11" />
        {state.fieldErrors?.fullName ? (
          <p className="text-sm text-destructive" role="alert">{state.fieldErrors.fullName}</p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">Celular</Label>
        <Input
          id="phone"
          name="phone"
          value={phoneValue}
          onChange={(event) => setPhoneValue(formatPhoneBr(event.target.value))}
          autoComplete="tel"
          inputMode="tel"
          required
          className="h-11"
        />
        {state.fieldErrors?.phone ? (
          <p className="text-sm text-destructive" role="alert">{state.fieldErrors.phone}</p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" value={email} readOnly className="h-11 bg-muted" />
        <p className="text-xs text-muted-foreground">O e-mail da conta não pode ser alterado por aqui.</p>
      </div>
      {state.error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-2xl bg-secondary/70 px-4 py-3 text-sm" role="status">
          {state.success}
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-fit rounded-full px-6" disabled={pending} aria-busy={pending}>
        {pending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </PortugueseForm>
  );
}
