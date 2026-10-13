"use client";

import { useActionState } from "react";
import { resendConfirmationAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const initial: ActionState = {};

export function ResendEmailButton() {
  const [state, action, pending] = useActionState(
    async () => resendConfirmationAction(),
    initial,
  );

  return (
    <form action={action} className="space-y-3">
      <Button type="submit" variant="outline" className="h-11 w-full" disabled={pending}>
        {pending ? "Enviando..." : "Enviar e-mail de novo"}
      </Button>
      {state.error ? (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-2xl bg-[var(--status-confirmed-bg)] px-4 py-3 text-sm text-[var(--status-confirmed-fg)]">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
