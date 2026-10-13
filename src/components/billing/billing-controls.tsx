"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/marketing/content";
import { billingRedirectSchema } from "@/lib/billing/stripe-contract";
import { checkoutDisabledReason, checkoutReturnMessage } from "@/lib/billing/presentation";
import { nextCheckoutAttempt, type CheckoutAttempt } from "@/lib/billing/checkout-attempt";
import type { BillingActionInput, BillingActionResult } from "@/lib/billing/action-handler";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const attempt = useRef<CheckoutAttempt>(null);
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
          attempt.current = nextCheckoutAttempt(attempt.current, selection, () => crypto.randomUUID());
          input = { action, plan, billingInterval: interval, idempotencyKey: attempt.current.key };
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

  return (
    <section className="grid gap-5" aria-label="Cobrança Stripe" aria-busy={pending}>
      <div>
        <h3 className="font-serif text-2xl text-wine-deep">Assinar o plano</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha Solo, Equipe ou Salão e se prefere pagar todo mês ou o ano. O período restante do teste será respeitado. Assinar não reinicia o teste.
        </p>
      </div>
      {returnMessage ? <div role="status" className="rounded-2xl bg-metric-blush p-4">{returnMessage}</div> : null}
      {error ? <p role="alert" className="rounded-xl border border-destructive p-4 text-destructive">{error}</p> : null}
      {pending ? <p role="status">Abrindo o ambiente seguro do Stripe…</p> : null}
      <fieldset disabled={pending || !props.canManage} className="grid gap-2">
        <legend className="mb-2 font-medium">Periodicidade</legend>
        <div className="grid grid-cols-2 gap-2 rounded-full bg-[#fff6f4] p-1 ring-1 ring-[#eadfd8]">
          {(["monthly", "annual"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-medium",
                interval === value ? "bg-primary text-primary-foreground" : "text-wine-deep",
              )}
            >
              <input
                type="radio"
                name="billingInterval"
                value={value}
                checked={interval === value}
                onChange={() => setInterval(value)}
                className="sr-only"
              />
              {value === "monthly" ? "Mensal" : "Anual"}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const reason = checkoutDisabledReason(plan.id, props.usedSeats, props.hasSubscription, props.status, props.canManage);
          return (
            <article key={plan.id} className="agende-panel grid content-start gap-4 rounded-[1.25rem] p-5 ring-1 ring-[#f0e4de]">
              <div>
                <h4 className="font-serif text-2xl text-wine-deep">{plan.name}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{plan.seats}</p>
              </div>
              <p className="font-serif text-3xl text-wine-deep">
                {interval === "annual" ? plan.annualPrice : `${plan.price}${plan.period}`}
              </p>
              <ul className="grid gap-1 text-sm text-muted-foreground">
                {plan.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <button
                type="button"
                className="h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                disabled={pending || !props.capabilities.checkout || Boolean(reason)}
                aria-describedby={reason ? `billing-${plan.id}-reason` : undefined}
                onClick={() => submit("checkout", plan.id)}
              >
                Assinar {plan.name} {interval === "annual" ? "anual" : "mensal"}
              </button>
              {reason ? <p id={`billing-${plan.id}-reason`} className="text-sm text-muted-foreground">{reason}</p> : null}
            </article>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        {props.canManage && props.hasCustomer && props.capabilities.portal ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => submit("portal")}
            className="h-11 rounded-full border px-4 text-sm disabled:opacity-50"
          >
            Abrir Portal Stripe
          </button>
        ) : null}
        <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
          Atualizar dados da assinatura
        </Button>
      </div>
      {props.hasCustomer ? (
        <p className="text-sm text-muted-foreground">
          No Portal você pode consultar faturas, atualizar o cartão e cancelar a assinatura ao fim do período.
        </p>
      ) : null}
    </section>
  );
}
