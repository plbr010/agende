"use client";

import { useActionState, useState } from "react";
import { PLANS } from "@/lib/marketing/content";
import { TRIAL_COPY, type PlanId } from "@/lib/billing/plans";
import { createWorkspaceAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const initial: ActionState = {};

export function CreateWorkspaceForm({ defaultPlan = "equipe" }: { defaultPlan?: PlanId }) {
  const [state, action, pending] = useActionState(createWorkspaceAction, initial);
  const [plan, setPlan] = useState<PlanId>(defaultPlan);

  return (
    <form action={action} className="grid gap-5">
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
          aria-invalid={Boolean(state.fieldErrors?.name)}
          aria-describedby={state.fieldErrors?.name ? "name-error" : undefined}
        />
        {state.fieldErrors?.name ? (
          <p id="name-error" className="text-sm text-destructive">
            {state.fieldErrors.name}
          </p>
        ) : null}
      </div>
      <fieldset className="grid gap-3">
        <legend className="mb-1 font-medium">Escolha seu plano</legend>
        <p className="text-sm text-muted-foreground">Você pode trocar durante o trial sem reiniciar os 7 dias.</p>
        {PLANS.map((item) => (
          <label
            key={item.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors focus-within:ring-3 focus-within:ring-ring/50",
              plan === item.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
            )}
          >
            <input
              type="radio"
              name="plan"
              value={item.id}
              required
              checked={plan === item.id}
              onChange={() => setPlan(item.id)}
              className="mt-1 size-4"
            />
            <span className="min-w-0">
              <strong>{item.name}</strong>
              {item.popular ? <span className="ml-2 text-xs text-primary">Mais escolhido</span> : null}
              <span className="mt-1 block text-sm text-muted-foreground">
                {item.seats} · {item.price}
                {item.period} · ou {item.annualPrice}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted-foreground">{TRIAL_COPY}</p>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-12" disabled={pending}>
        {pending ? "Criando..." : "Começar 7 dias grátis"}
      </Button>
    </form>
  );
}
