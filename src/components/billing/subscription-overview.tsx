import { PLANS } from "@/lib/marketing/content";
import type { SubscriptionDetail } from "@/lib/workspace/queries";
import type { SeatUsage } from "@/lib/workspace/public";
import { PLAN_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/lib/workspace/labels";
import { formatDateTime } from "@/lib/workspace/timezone";
import { trialDaysRemaining } from "@/lib/billing/plans";
import { ManagementForm } from "@/components/modules/management-form";
export function SubscriptionOverview({ subscription, seats, timezone }: {
    subscription: SubscriptionDetail | null;
    seats: SeatUsage | null;
    timezone: string;
    capabilities: {
        checkout: boolean;
        portal: boolean;
    };
}) {
    const days = trialDaysRemaining(subscription?.trialEndsAt);
    const trial = subscription?.status === "trialing" && days > 0;
    return <div className="grid gap-5">
    <section className="rounded-3xl bg-primary p-8 text-primary-foreground">
    <p>Assinatura do negócio</p>
    <h2 className="mt-2 font-serif text-4xl">{subscription ? PLAN_LABEL[subscription.plan] : "Plano indisponível"}</h2>
    <p className="mt-3">{subscription ? SUBSCRIPTION_STATUS_LABEL[subscription.status] : "Não disponível"}</p>
    <p className="mt-3">Profissionais: {seats ? seats.usedProfessionals + " de " + seats.maxProfessionals : "Não disponível"}</p>{subscription?.trialEndsAt && <div className="mt-4">
        <p className="text-xl">{days} dias restantes de teste</p>
        <p>Termina em {formatDateTime(subscription.trialEndsAt, timezone)}</p>
        </div>}</section>
    <p className="rounded-2xl bg-secondary p-4">Trocar de plano durante o teste não reinicia os 7 dias nem altera a data final.</p>
    <section className="grid gap-4 lg:grid-cols-3">{PLANS.map(p => <article key={p.id} className={"grid content-start gap-4 rounded-2xl border bg-card p-5 " + (p.popular ? "border-primary ring-1 ring-primary" : "")}>
        <h3 className="text-xl font-semibold">{p.name}{p.popular && <span className="ml-2 text-xs text-primary">Mais escolhido</span>}</h3>
        <p>{p.seats}</p>
        <p>
        <strong className="text-2xl">{p.price}</strong>{p.period}</p>
        <p className="text-sm text-muted-foreground">{p.annualPrice}</p>{subscription?.plan === p.id ? <p className="font-semibold text-primary">Plano atual</p> : trial ? <ManagementForm action="trial" label={"Trocar para " + p.name}>
            <input type="hidden" name="plan" value={p.id}/>
            </ManagementForm> : <p className="text-sm">Troca disponível durante o teste.</p>}</article>)}</section>
    <section className="rounded-2xl border bg-card p-5">
    <h3 className="text-xl font-semibold">Cobrança</h3>
    <p className="mt-2 text-muted-foreground">Os pagamentos online ainda não estão disponíveis. Nenhum cartão é necessário para testar.</p>
    </section>
    </div>;
}
