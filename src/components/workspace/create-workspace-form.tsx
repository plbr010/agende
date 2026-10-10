"use client";

import { PLANS } from "@/lib/marketing/content";
import { type PlanId } from "@/lib/billing/plans";
import { TRIAL_PLAIN } from "@/lib/usability/copy";
import { useActionState } from "react";
import { createWorkspaceAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const initial: ActionState = {};

export function CreateWorkspaceForm({ defaultPlan = "equipe" }: { defaultPlan?: PlanId }) {
  const [state, action, pending] = useActionState(createWorkspaceAction, initial);

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="name">Nome do salão ou estúdio</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          className="h-11"
          placeholder="Ex.: Studio Ana, Salão Bella"
        />
        {state.fieldErrors?.name ? <p className="text-sm text-destructive">{state.fieldErrors.name}</p> : null}
      </div>
      <fieldset className="grid gap-3">
        <legend className="mb-1 font-medium">Escolha seu plano</legend>
        <p className="text-sm text-muted-foreground">Você pode trocar durante os 7 dias grátis.</p>
        {PLANS.map((plan) => (
          <label
            key={plan.id}
            className={cn(
              "flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border p-4",
              plan.id === defaultPlan ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            <input
              type="radio"
              name="plan"
              value={plan.id}
              required
              defaultChecked={plan.id === defaultPlan}
              className="mt-1 size-5"
            />
            <span className="min-w-0">
              <strong>{plan.name}</strong>
              {plan.popular ? <span className="ml-2 text-xs text-primary">Mais escolhido</span> : null}
              <span className="mt-1 block text-sm text-muted-foreground">
                {plan.seats} · depois do teste: {plan.price}
                {plan.period}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">Ou {plan.annualPrice} se pagar o ano.</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted-foreground">{TRIAL_PLAIN}</p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" className="h-12" disabled={pending}>
        {pending ? "Criando..." : "Criar salão e começar teste grátis"}
      </Button>
    </form>
  );
}
