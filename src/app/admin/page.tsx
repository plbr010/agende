import {
  Building2,
  CalendarDays,
  CreditCard,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { AdminTrendChart } from "@/components/admin/charts";
import { StatusBadge } from "@/components/admin/status-badge";
import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { formatCount, formatMoney, formatPercent, formatPlan } from "@/lib/admin/format";
import { loadAdminDashboard } from "@/lib/admin/queries";

export default async function AdminDashboardPage() {
  const { provisionPending } = await requirePlatformAdmin("/admin", { allowProvision: true });
  if (provisionPending) return null;

  let dashboard: Awaited<ReturnType<typeof loadAdminDashboard>>;
  try {
    dashboard = await loadAdminDashboard();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível carregar o painel.";
    return (
      <div className="rounded-[1.5rem] bg-card p-6 text-sm text-destructive ring-1 ring-destructive/20" role="alert">
        {message}
      </div>
    );
  }

  const { metrics } = dashboard;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Painel master"
        title="Visão da plataforma"
        description="Indicadores reais de cadastros, assinaturas e faturamento registrados no Agendê. O plano Empresa não existe neste produto; os planos vigentes são Solo, Equipe e Salão."
        icon={TrendingUp}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Cadastros">
        <MetricCard label="Profissionais" value={formatCount(metrics.professionals)} hint="Contas profissionais e membros de atendimento" icon={Users} />
        <MetricCard label="Estabelecimentos" value={formatCount(metrics.workspaces)} hint="Salões cadastrados" icon={Building2} tone="neutral" />
        <MetricCard label="Clientes" value={formatCount(metrics.clients)} hint={`${formatCount(metrics.workspace_clients)} fichas nos salões`} icon={UsersRound} />
        <MetricCard label="Usuários ativos" value={formatCount(metrics.active_users)} hint={`${formatCount(metrics.users)} cadastros no total`} icon={UserPlus} tone="success" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Movimento recente">
        <MetricCard label="Novos hoje" value={formatCount(metrics.signups_today)} hint="Cadastros no fuso de Brasília" icon={UserPlus} />
        <MetricCard label="Últimos 7 dias" value={formatCount(metrics.signups_7d)} hint="Novos perfis na semana" icon={UserPlus} tone="neutral" />
        <MetricCard label="Últimos 30 dias" value={formatCount(metrics.signups_30d)} hint="Novos perfis no mês" icon={UserPlus} />
        <MetricCard label="Agendamentos" value={formatCount(metrics.appointments)} hint="Todos os status, sem apagar histórico" icon={CalendarDays} tone="neutral" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Assinaturas e receita">
        <MetricCard label="Assinaturas ativas" value={formatCount(metrics.subscriptions_active)} hint="Planos pagos em vigor" icon={CreditCard} tone="success" />
        <MetricCard label="Em teste" value={formatCount(metrics.subscriptions_trialing)} hint="Trial de 7 dias" icon={CreditCard} />
        <MetricCard label="Canceladas" value={formatCount(metrics.subscriptions_canceled)} hint={`${formatCount(metrics.subscriptions_past_due)} inadimplentes`} icon={TrendingDown} tone="warning" />
        <MetricCard label="MRR" value={formatMoney(metrics.mrr_cents)} hint={`Receita acumulada ${formatMoney(metrics.revenue_cents)}`} icon={TrendingUp} tone="success" />
      </section>

      <section className="grid gap-3 lg:grid-cols-2" aria-label="Conversão">
        <article className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
          <p className="text-sm text-muted-foreground">Conversão de teste para assinatura</p>
          <p className="mt-2 font-serif text-4xl text-wine-deep">{formatPercent(metrics.trial_conversion_rate)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Entre assinaturas que tiveram trial e hoje estão ativas.</p>
        </article>
        <article className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
          <p className="text-sm text-muted-foreground">Cancelamento em 30 dias</p>
          <p className="mt-2 font-serif text-4xl text-wine-deep">{formatPercent(metrics.churn_rate_30d)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Canceladas no período sobre a base ativa do mesmo recorte.</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3" aria-label="Gráficos">
        <AdminTrendChart
          title="Crescimento de cadastros"
          hint="Novos perfis nos últimos 30 dias"
          points={dashboard.growth.map((row) => ({ date: row.date, value: row.count }))}
        />
        <AdminTrendChart
          title="Novas assinaturas"
          hint="Assinaturas criadas nos últimos 30 dias"
          points={dashboard.subscription_growth.map((row) => ({ date: row.date, value: row.count }))}
        />
        <AdminTrendChart
          title="Faturamento registrado"
          hint="Eventos Stripe pagos com valor no banco"
          points={dashboard.revenue.map((row) => ({ date: row.date, value: row.cents }))}
          kind="money"
        />
      </section>

      <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
        <h2 className="font-medium text-wine-deep">Planos vigentes</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {metrics.plans.map((plan) => (
            <div key={plan.code} className="rounded-2xl bg-muted/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <StatusBadge value={plan.code} kind="plan" />
                <p className="text-sm text-muted-foreground">até {plan.max_professionals} profissionais</p>
              </div>
              <p className="mt-3 font-serif text-2xl text-wine-deep">{formatMoney(plan.monthly_price_cents)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatPlan(plan.code)} mensal
                {plan.annual_price_cents ? ` · anual ${formatMoney(plan.annual_price_cents)}` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
