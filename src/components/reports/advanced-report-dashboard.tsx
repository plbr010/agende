import { BarChart3, ChartNoAxesCombined, CircleDollarSign } from "lucide-react";
import { MetricCard } from "@/components/app/metric-card";
import { BackendContractNotice } from "@/components/modules/backend-contract-notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdvancedReport } from "@/lib/reports/queries";
import { formatCentsToReais } from "@/lib/validation/money";

function formatIndicator(value: number, format: "currency" | "number" | "percent") {
  if (format === "currency") return formatCentsToReais(value);
  if (format === "percent") return `${value.toLocaleString("pt-BR")}%`;
  return value.toLocaleString("pt-BR");
}

export function AdvancedReportDashboard({ report }: { report: AdvancedReport | null }) {
  if (!report) {
    return <BackendContractNotice title="Relatório avançado preparado" description="A página não recalcula indicadores a partir dos agendamentos. KPIs, séries, rankings e composições serão exibidos exatamente a partir do relatório real." fields={["KPIs consolidados", "Série de receitas e despesas", "Rankings do backend", "Composição por categoria e pagamento"]} />;
  }
  const maxCashFlow = Math.max(1, ...report.cashFlowSeries.flatMap((point) => [point.revenueCents, point.expenseCents]));
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={`Indicadores de ${report.period.label}`}>{report.indicators.map((indicator) => <MetricCard key={indicator.id} label={indicator.label} value={formatIndicator(indicator.value, indicator.format)} hint={indicator.comparisonLabel ?? report.period.label} icon={indicator.format === "currency" ? CircleDollarSign : ChartNoAxesCombined} />)}</section>
      <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><BarChart3 className="size-5 text-primary" /> Fluxo do período</CardTitle><CardDescription>Receitas e despesas consolidadas pelo relatório avançado.</CardDescription></CardHeader><CardContent className="grid gap-4">{report.cashFlowSeries.map((point) => <div key={point.label} className="grid grid-cols-[5rem_1fr] items-center gap-3"><span className="text-xs text-muted-foreground">{point.label}</span><div className="grid gap-1"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(2, point.revenueCents / maxCashFlow * 100)}%` }} /><div className="h-2 rounded-full bg-destructive/65" style={{ width: `${Math.max(2, point.expenseCents / maxCashFlow * 100)}%` }} /></div></div>)}</CardContent></Card>
      <section className="grid gap-4 xl:grid-cols-2">{report.rankings.map((ranking) => <Card key={ranking.id} className="rounded-3xl border-border/70 bg-card/85 shadow-sm"><CardHeader><CardTitle className="text-xl">{ranking.title}</CardTitle></CardHeader><CardContent className="grid gap-3">{ranking.items.map((item, index) => <div key={`${ranking.id}-${item.label}`} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/45 px-4 py-3 text-sm"><span><span className="mr-2 text-muted-foreground">{index + 1}.</span>{item.label}</span><span className="font-medium">{item.formattedValue}</span></div>)}</CardContent></Card>)}</section>
    </>
  );
}
