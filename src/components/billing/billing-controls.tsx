"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/marketing/content";
import { billingRedirectSchema } from "@/lib/billing/stripe-contract";
import { checkoutDisabledReason, checkoutReturnMessage } from "@/lib/billing/presentation";
import type { BillingActionInput, BillingActionResult } from "@/lib/billing/action-handler";

export type BillingControlsProps = {
  canManage: boolean;
  usedSeats: number | null;
  hasCustomer: boolean;
  hasSubscription: boolean;
  status?: string;
  initialInterval: "monthly" | "annual";
  checkoutReturn?: string;
  capabilities: { checkout: boolean; portal: boolean };
  action: (input: BillingActionInput) => Promise<BillingActionResult>;
};

export function BillingControls(props: BillingControlsProps) {
  const router = useRouter();
  const [interval, setInterval] = useState(props.initialInterval);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const attempts = useRef<Record<string, string>>({});
  const returnMessage = checkoutReturnMessage(props.checkoutReturn);

  function submit(action: "checkout" | "portal", plan?: "solo" | "equipe" | "salao") {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    startTransition(async () => {
      try {
        let input: BillingActionInput = { action: "portal" };
        if (action === "checkout" && plan) {
          const selection = `${plan}:${interval}`;
          attempts.current[selection] ??= crypto.randomUUID();
          input = { action, plan, billingInterval: interval, idempotencyKey: attempts.current[selection] };
        }
        const result = await props.action(input);
        if (result.error) { setError(result.error); return; }
        window.location.assign(billingRedirectSchema.parse(result).url);
      } catch {
        setError("Não foi possível abrir a cobrança. Verifique sua conexão e tente novamente.");
      } finally {
        busy.current = false;
      }
    });
  }

  return <section className="grid gap-5" aria-label="Cobrança Stripe" aria-busy={pending}>
    <h3 className="text-xl font-semibold">Assinar com Stripe</h3>
    {returnMessage && <div role="status" className="rounded-2xl bg-secondary p-4">{returnMessage}</div>}
    {error && <p role="alert" className="rounded-xl border border-destructive p-4 text-destructive">{error}</p>}
    {pending && <p role="status">Abrindo o ambiente seguro do Stripe…</p>}
    <p className="text-sm text-muted-foreground">O período restante do teste será respeitado. Assinar não reinicia o teste.</p>
    <fieldset disabled={pending || !props.canManage} className="flex gap-4">
      <legend className="mb-2 font-medium">Periodicidade</legend>
      {(["monthly", "annual"] as const).map(value => <label key={value} className="flex items-center gap-2">
        <input type="radio" name="billingInterval" value={value} checked={interval === value} onChange={() => setInterval(value)} />
        {value === "monthly" ? "Mensal" : "Anual"}
      </label>)}
    </fieldset>
    <div className="grid gap-4 lg:grid-cols-3">{PLANS.map(plan => {
      const reason = checkoutDisabledReason(plan.id, props.usedSeats, props.hasSubscription, props.status, props.canManage);
      return <article key={plan.id} className="grid content-start gap-4 rounded-2xl border bg-card p-5">
        <h4 className="text-xl font-semibold">{plan.name}</h4>
        <p>{plan.seats}</p>
        <p className="text-2xl font-semibold">{interval === "annual" ? plan.annualPrice : `${plan.price}${plan.period}`}</p>
        <button type="button" className="rounded-xl bg-primary p-3 text-primary-foreground disabled:opacity-50"
          disabled={pending || !props.capabilities.checkout || Boolean(reason)}
          aria-describedby={reason ? `billing-${plan.id}-reason` : undefined}
          onClick={() => submit("checkout", plan.id)}>Assinar {plan.name} {interval === "annual" ? "anual" : "mensal"}</button>
        {reason && <p id={`billing-${plan.id}-reason`} className="text-sm text-muted-foreground">{reason}</p>}
      </article>;
    })}</div>
    <div className="flex flex-wrap gap-3">
      {props.canManage && props.hasCustomer && props.capabilities.portal &&
        <button type="button" disabled={pending} onClick={() => submit("portal")} className="rounded-xl border p-3 disabled:opacity-50">Abrir Portal Stripe</button>}
      <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="rounded-xl border p-3">Atualizar dados da assinatura</button>
    </div>
    {props.hasCustomer && <p className="text-sm text-muted-foreground">No Portal você pode consultar faturas, atualizar o cartão e cancelar a assinatura ao fim do período.</p>}
  </section>;
}
