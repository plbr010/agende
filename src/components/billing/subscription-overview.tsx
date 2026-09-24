import { CalendarClock, Check, CreditCard, ExternalLink, LockKeyhole, Sparkles, UsersRound } from "lucide-react";
import { PLANS } from "@/lib/marketing/content";
import type { SubscriptionDetail } from "@/lib/workspace/queries";
import type { SeatUsage } from "@/lib/workspace/public";
import { PLAN_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/lib/workspace/labels";
import { formatDateTime } from "@/lib/workspace/timezone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SubscriptionOverview({
  subscription,
  seats,
  timezone,
  capabilities,
}: {
  subscription: SubscriptionDetail | null;
  seats: SeatUsage | null;
  timezone: string;
  capabilities: { checkout: boolean; portal: boolean };
}) {
  const currentPlan = subscription?.plan ?? "solo";

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden rounded-3xl border-border/70 bg-primary text-primary-foreground shadow-xl shadow-primary/15">
        <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-primary-foreground/70 uppercase"><Sparkles className="size-3.5" /> Assinatura do negócio</p>
            <div className="mt-3 flex flex-wrap items-center gap-2"><h2 className="font-serif text-4xl">{PLAN_LABEL[currentPlan]}</h2><Badge variant="secondary">{SUBSCRIPTION_STATUS_LABEL[subscription?.status ?? "expired"]}</Badge></div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">Plano, cobrança e assentos pertencem ao workspace. Nenhum checkout é simulado nesta tela.</p>
          </div>
          <div className="grid gap-1 rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/15"><p className="flex items-center gap-2 text-xs text-primary-foreground/70"><UsersRound className="size-3.5" /> Uso da equipe</p><p className="font-serif text-2xl">{seats ? `${seats.usedProfessionals} de ${seats.maxProfessionals}` : "Não disponível"}</p></div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Planos do Agendê">
        {PLANS.map((plan) => {
          const current = plan.id === currentPlan;
          return (
            <Card key={plan.id} className={current ? "rounded-3xl border-primary/35 bg-primary/5 shadow-sm ring-1 ring-primary/15" : "rounded-3xl border-border/70 bg-card/85 shadow-sm"}>
              <CardHeader><div className="flex items-center justify-between gap-2"><CardTitle className="text-xl">{plan.name}</CardTitle>{current ? <Badge>Plano atual</Badge> : null}</div><CardDescription>{plan.seats}</CardDescription></CardHeader>
              <CardContent className="grid gap-5"><p><span className="font-serif text-3xl">{plan.price}</span><span className="text-sm text-muted-foreground">{plan.period}</span></p><div className="flex items-center gap-2 text-sm text-muted-foreground"><Check className="size-4 text-primary" /> 7 dias de trial no primeiro workspace</div><Button disabled={!capabilities.checkout || current} variant={current ? "secondary" : "outline"} className="h-11 w-full rounded-full">{current ? "Plano atual" : capabilities.checkout ? "Escolher plano" : "Checkout após conectar Stripe"}</Button></CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><CalendarClock className="size-5 text-primary" /> Ciclo atual</CardTitle><CardDescription>Datas mantidas pelo backend da assinatura.</CardDescription></CardHeader><CardContent className="grid gap-3 text-sm"><div className="flex justify-between gap-4"><span className="text-muted-foreground">Trial iniciado</span><span>{formatDateTime(subscription?.trialStartedAt, timezone)}</span></div><div className="flex justify-between gap-4"><span className="text-muted-foreground">Trial termina</span><span>{formatDateTime(subscription?.trialEndsAt, timezone)}</span></div><div className="flex justify-between gap-4"><span className="text-muted-foreground">Período atual</span><span className="text-right">{formatDateTime(subscription?.currentPeriodStart, timezone)} → {formatDateTime(subscription?.currentPeriodEnd, timezone)}</span></div></CardContent></Card>
        <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><CreditCard className="size-5 text-primary" /> Cobrança</CardTitle><CardDescription>O portal abrirá em uma sessão segura criada no servidor.</CardDescription></CardHeader><CardContent className="grid gap-4"><Button disabled={!capabilities.portal} variant="outline" className="h-11 w-full rounded-full"><ExternalLink className="size-4" /> {capabilities.portal ? "Abrir portal de cobrança" : "Portal após conectar Stripe"}</Button><p className="flex items-start gap-2 rounded-2xl bg-secondary/55 p-4 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-primary" /> Nenhuma chave, customer ID, sessão de checkout ou chamada Stripe foi criada nesta etapa.</p></CardContent></Card>
      </section>
    </div>
  );
}
