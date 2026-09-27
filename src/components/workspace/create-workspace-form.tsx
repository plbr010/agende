"use client";

import { PLANS } from "@/lib/marketing/content";
import { TRIAL_COPY } from "@/lib/billing/plans";
import { useActionState } from "react";
import { createWorkspaceAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionState = {};

export function CreateWorkspaceForm() {
  const [state, action, pending] = useActionState(createWorkspaceAction, initial);

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Nome do negócio</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          className="h-11"
          placeholder="Estúdio Luna, Studio Ana, Barbearia Norte..."
        />
        {state.fieldErrors?.name ? <p className="text-sm text-destructive">{state.fieldErrors.name}</p> : null}
      </div>
      <fieldset className="grid gap-3"><legend className="mb-3 font-medium">Escolha seu plano</legend>{PLANS.map(plan => <label key={plan.id} className={plan.popular ? "flex gap-3 rounded-2xl border-2 border-primary bg-primary/5 p-4" : "flex gap-3 rounded-2xl border p-4"}><input type="radio" name="plan" value={plan.id} required defaultChecked={plan.id === "equipe"} /><span><strong>{plan.name}</strong>{plan.popular && <span className="ml-2 text-xs text-primary">Mais escolhido</span>}<span className="block text-sm">{plan.seats} · {plan.price}{plan.period}</span></span></label>)}</fieldset>
      <p className="text-sm text-muted-foreground">{TRIAL_COPY}</p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" className="h-12" disabled={pending}>
        {pending ? "Criando..." : "Começar 7 dias grátis"}
      </Button>
    </form>
  );
}
