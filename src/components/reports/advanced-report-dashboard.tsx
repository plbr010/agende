import { Boxes, ChartNoAxesCombined, CircleDollarSign, PackageCheck, UsersRound } from "lucide-react";
import { MetricCard } from "@/components/app/metric-card";
import { BackendContractNotice } from "@/components/modules/backend-contract-notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdvancedReport } from "@/lib/reports/queries";
import { formatCentsToReais } from "@/lib/validation/money";

export function AdvancedReportDashboard({ report }: { report: AdvancedReport | null }) {
  if (!report) {
    return <BackendContractNotice title="Relatórios indisponíveis" description="Não foi possível carregar os indicadores. Atualize a página para tentar novamente." fields={["Operação e clientes", "Financeiro por categoria", "Profissionais e pagamentos", "Pacotes e estoque"]} />;
  }

  return (
    <>
      <h2 className="text-xl font-semibold">Visão geral</h2>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={`Indicadores de ${report.period.startDate} a ${report.period.endDate}`}>
        <MetricCard label="Atendimentos" value={report.operations.appointmentsTotal} hint={`${report.operations.completionRatePct.toLocaleString("pt-BR")}% concluídos`} icon={ChartNoAxesCombined} />
        <MetricCard label="Clientes únicos" value={report.clients.uniqueClients} hint={`${report.clients.newClients} novos no período`} icon={UsersRound} />
        <MetricCard label="Valor concluído" value={formatCentsToReais(report.operations.completedServiceValueCents)} hint={`Preço médio ${formatCentsToReais(report.operations.averageServiceTicketCents)}`} icon={CircleDollarSign} />
        <MetricCard label="Estoque baixo" value={report.inventory.lowStock} hint={`${report.inventory.outOfStock} sem estoque`} icon={Boxes} tone="warning" />
      </section>
      <section className="grid gap-4 sm:grid-cols-2"><Card><CardHeader><CardTitle>Agenda</CardTitle></CardHeader><CardContent><p>{report.operations.completed} concluídos · {report.operations.cancelled} cancelados · {report.operations.noShow} faltas</p><p className="text-sm text-muted-foreground">Cancelamentos: {report.operations.cancellationRatePct}% · Faltas: {report.operations.noShowRatePct}%</p></CardContent></Card><Card><CardHeader><CardTitle>Clientes</CardTitle></CardHeader><CardContent><p>{report.clients.uniqueClients} atendidos · {report.clients.newClients} novos · {report.clients.repeatClients} recorrentes</p></CardContent></Card></section>
      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
          <CardHeader><CardTitle className="text-xl">Profissionais em destaque</CardTitle><CardDescription>Atendimentos concluídos no período.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">{!report.topProfessionals.length && <p>Nenhum atendimento concluído no período.</p>}{report.topProfessionals.map((professional, index) => <div key={professional.professionalMemberId} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/45 px-4 py-3 text-sm"><span><span className="mr-2 text-muted-foreground">{index + 1}.</span>{professional.professionalName}</span><span className="text-right font-medium">{professional.completedCount} · {formatCentsToReais(professional.serviceValueCents)}</span></div>)}</CardContent>
        </Card>
        <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
          <CardHeader><CardTitle className="text-xl">Financeiro por categoria</CardTitle><CardDescription>Entradas e saídas líquidas no período.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">{!report.financeByCategory.length && <p>Nenhum lançamento no período.</p>}{report.financeByCategory.map((category) => <div key={`${category.entryType}-${category.categoryName}`} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/45 px-4 py-3 text-sm"><span>{category.categoryName}</span><span className={category.entryType === "expense" ? "font-medium text-destructive" : "font-medium text-primary"}>{category.entryType === "expense" ? "−" : "+"}{formatCentsToReais(category.netCents)}</span></div>)}</CardContent>
        </Card>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <MetricCard label="Pacotes vendidos" value={report.packages.sold} hint={`${report.packages.redemptions} sessões usadas · ${report.packages.reversedRedemptions} desfeitas`} icon={PackageCheck} />
        <MetricCard label="Custo estimado em estoque" value={formatCentsToReais(report.inventory.estimatedStockCostCents)} hint={`${report.inventory.activeProducts} produtos ativos · posição atual`} icon={Boxes} tone="neutral" />
      </section>
    </>
  );
}
