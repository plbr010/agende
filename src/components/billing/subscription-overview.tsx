import { PLANS } from "@/lib/marketing/content";
import type { SubscriptionDetail } from "@/lib/workspace/queries";
import type { SeatUsage } from "@/lib/workspace/public";
import { PLAN_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/lib/workspace/labels";
import { formatDateTime } from "@/lib/workspace/timezone";
import { trialDaysRemaining } from "@/lib/billing/plans";
import { ManagementForm } from "@/components/modules/management-form";
import { BillingControls } from "./billing-controls";
import type { BillingActionInput, BillingActionResult } from "@/lib/billing/action-handler";
import { cn } from "@/lib/utils";

export function SubscriptionOverview({
  subscription,
  seats,
  timezone,
  capabilities,
  canManage,
  checkoutReturn,
  billingAction,
}: {
  canManage: boolean;
  checkoutReturn?: string;
  billingAction: (input: BillingActionInput) => Promise<BillingActionResult>;
  subscription: SubscriptionDetail | null;
  seats: SeatUsage | null;
  timezone: string;
  capabilities: {
    checkout: boolean;
    portal: boolean;
  };
}) {
  const days = trialDaysRemaining(subscription?.trialEndsAt);
  const trial = subscription?.status === "trialing" && days > 0 && !subscription.hasStripeSubscription && canManage;

  return (
    <div className="grid gap-5">
      <section className="rounded-[1.5rem] bg-wine-deep p-6 text-white sm:p-8">
        <p className="text-xs font-semibold tracking-[0.16em] text-white/70 uppercase">Assinatura do negócio</p>
        <h2 className="mt-2 font-serif text-4xl">{subscription ? PLAN_LABEL[subscription.plan] : "Plano indisponível"}</h2>
        <p className="mt-3 text-white/85">{subscription ? SUBSCRIPTION_STATUS_LABEL[subscription.status] : "Não disponível"}</p>
        <p className="mt-3 text-white/85">
          Profissionais: {seats ? `${seats.usedProfessionals} de ${seats.maxProfessionals}` : "Não disponível"}
        </p>
        {subscription?.trialEndsAt ? (
          <div className="mt-5 rounded-2xl bg-white/10 p-4">
            <p className="font-serif text-3xl">
              {days === 1 ? "1 dia restante de teste" : `${days} dias restantes de teste`}
            </p>
            <p className="mt-1 text-sm text-white/80">Termina em {formatDateTime(subscription.trialEndsAt, timezone)}</p>
            <p className="mt-2 text-sm text-white/80">7 dias grátis, sem cartão. Trocar de plano no teste não zera os dias.</p>
          </div>
        ) : null}
      </section>

      <p className="rounded-2xl bg-metric-blush px-4 py-3 text-sm">
        Trocar de plano durante o teste não reinicia os 7 dias nem altera a data final.
      </p>

      {trial ? (
        <section className="grid gap-4 lg:grid-cols-3" aria-label="Plano durante o teste">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                "agende-panel grid content-start gap-4 rounded-[1.25rem] p-5 ring-1",
                plan.popular ? "ring-primary" : "ring-[#f0e4de]",
              )}
            >
              <h3 className="font-serif text-2xl text-wine-deep">
                {plan.name}
                {plan.popular ? <span className="ml-2 text-xs font-sans text-primary">Mais escolhido</span> : null}
              </h3>
              <p className="text-sm text-muted-foreground">{plan.seats}</p>
              <p>
                <strong className="font-serif text-2xl text-wine-deep">{plan.price}</strong>
                {plan.period}
              </p>
              <p className="text-sm text-muted-foreground">{plan.annualPrice}</p>
              {subscription?.plan === plan.id ? (
                <p className="font-semibold text-primary">Plano atual</p>
              ) : trial ? (
                <ManagementForm action="trial" label={"Trocar para " + plan.name}>
                  <input type="hidden" name="plan" value={plan.id} />
                </ManagementForm>
              ) : (
                <p className="text-sm">Troca disponível durante o teste.</p>
              )}
            </article>
          ))}
        </section>
      ) : null}

      <section className="agende-panel rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de]">
        <BillingControls
          canManage={canManage}
          usedSeats={seats?.usedProfessionals ?? null}
          hasCustomer={subscription?.hasStripeCustomer ?? false}
          hasSubscription={subscription?.hasStripeSubscription ?? false}
          status={subscription?.status}
          initialInterval={subscription?.billingInterval ?? "monthly"}
          capabilities={capabilities}
          checkoutReturn={checkoutReturn}
          action={billingAction}
        />
      </section>
    </div>
  );
}
