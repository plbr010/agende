"use client";

import { PLANS } from "@/lib/marketing/content";
import { type PlanId } from "@/lib/billing/plans";
import { TRIAL_PLAIN } from "@/lib/usability/copy";
import { useActionState, useState } from "react";
import { createWorkspaceAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PortugueseForm } from "@/components/usability/portuguese-form";

const initial: ActionState = {};

export function CreateWorkspaceForm({ defaultPlan = "equipe" }: { defaultPlan?: PlanId }) {
  const [state, action, pending] = useActionState(createWorkspaceAction, initial);
  const [selected, setSelected] = useState<PlanId>(defaultPlan);

  return (
    <PortugueseForm action={action} className="grid gap-5">
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
        <p className="text-sm text-muted-foreground">Você pode trocar durante os 7 dias grátis. Sem cartão agora.</p>
        <div className="grid gap-3">
          {PLANS.map((plan) => (
            <label
              key={plan.id}
              className={cn(
                "flex min-h-16 cursor-pointer items-start gap-3 rounded-[1.25rem] p-4 ring-1 transition-colors",
                selected === plan.id
                  ? "bg-metric-blush ring-2 ring-primary"
                  : "bg-white ring-[#eadfd8] hover:bg-metric-blush/40",
              )}
            >
              <input
                type="radio"
                name="plan"
                value={plan.id}
                required
                checked={selected === plan.id}
                onChange={() => setSelected(plan.id)}
                className="mt-1 size-5 accent-[var(--rose)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="font-serif text-xl text-wine-deep">{plan.name}</strong>
                    {plan.popular ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        Mais escolhido
                      </span>
                    ) : null}
                    {selected === plan.id ? (
                      <span className="text-xs font-medium text-[var(--rose-ink)]">Selecionado</span>
                    ) : null}
                  </span>
                  <span className="font-serif text-xl text-wine-deep">
                    {plan.price}
                    <span className="text-sm font-sans text-muted-foreground">{plan.period}</span>
                  </span>
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{plan.seats} · ou {plan.annualPrice}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{plan.highlights[0]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="rounded-2xl bg-metric-ivory px-4 py-3 text-sm text-muted-foreground">{TRIAL_PLAIN}</p>
      {state.error ? (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-12 rounded-full" disabled={pending} aria-busy={pending}>
        {pending ? "Criando..." : "Criar salão e começar teste grátis"}
      </Button>
    </PortugueseForm>
  );
}
