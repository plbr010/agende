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
        {pending ? "Reenviando..." : "Reenviar e-mail"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success-foreground">{state.success}</p> : null}
    </form>
  );
}
