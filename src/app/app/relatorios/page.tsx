import { BarChart3, CalendarCheck2, ChartNoAxesCombined, Sparkles, UsersRound } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { loadAgendaRange } from "@/lib/agenda/queries";
import { loadClients, loadServices, loadTeam } from "@/lib/catalog/queries";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { IntegrationBanner } from "@/components/modules/integration-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { todayInProductTz } from "@/lib/time/timezone";
import { formatCentsToReais } from "@/lib/validation/money";
import { monthBounds, rankAppointments, summarizeAppointments, type RankedMetric } from "@/lib/modules/presentation";

function Ranking({ title, description, items }: { title: string; description: string; items: RankedMetric[] }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sem atendimentos válidos neste período.</p>
        ) : items.map((item, index) => (
          <div key={item.label} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate"><span className="mr-2 text-muted-foreground">{index + 1}.</span>{item.label}</span>
              <span className="shrink-0 font-medium">{item.count} · {formatCentsToReais(item.revenueCents)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default async function ReportsPage() {
  const session = await requireConfirmedSession("/app/relatorios");
  const workspace = session.workspaces[0];
  if (!workspace) return null;

  const bounds = monthBounds(todayInProductTz());
  const [appointments, clients, services, team] = await Promise.all([
    loadAgendaRange(workspace.id, bounds.from, bounds.toExclusive),
    loadClients(workspace.id),
    loadServices(workspace.id),
    loadTeam(workspace.id),
  ]);
  const summary = summarizeAppointments(appointments);
  const topServices = rankAppointments(appointments, "serviceName");
  const topProfessionals = rankAppointments(appointments, "professionalName");

  return (
    <>
      <PageHeader
        eyebrow="Decisões com contexto"
        title="Relatórios"
        description="Uma leitura clara do mês para reconhecer o que funciona e escolher o próximo passo do negócio."
        icon={ChartNoAxesCombined}
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores do mês">
        <MetricCard label="Atendimentos" value={summary.total} hint="registros no mês" icon={CalendarCheck2} />
        <MetricCard label="Receita prevista" value={formatCentsToReais(summary.expectedRevenueCents)} hint="agenda sem cancelados e faltas" icon={BarChart3} tone="success" />
        <MetricCard label="Clientes" value={clients.length} hint="na base atual" icon={UsersRound} tone="warning" />
        <MetricCard label="Operação" value={`${services.filter((item) => item.active).length}/${team.filter((item) => item.status === "active").length}`} hint="serviços ativos / pessoas" icon={Sparkles} tone="neutral" />
      </section>
      <IntegrationBanner
        title="Indicadores atuais conectados à operação"
        description="Agenda, clientes, serviços e equipe já usam o backend real. Custos, produtos, pacotes, pagamentos e comparativos históricos entrarão somente após a sincronização segura das migrations remotas."
      />
      <section className="grid gap-4 xl:grid-cols-2">
        <Ranking title="Serviços mais procurados" description="Volume e valor previsto no mês." items={topServices} />
        <Ranking title="Ritmo da equipe" description="Atendimentos e valor previsto por profissional." items={topProfessionals} />
      </section>
    </>
  );
}
