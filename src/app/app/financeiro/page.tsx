import { CircleDollarSign, Clock3, HandCoins, ReceiptText, TrendingUp } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { loadAgendaRange } from "@/lib/agenda/queries";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { IntegrationBanner } from "@/components/modules/integration-banner";
import { EmptyModuleState } from "@/components/modules/empty-module-state";
import { todayInProductTz } from "@/lib/time/timezone";
import { formatCentsToReais } from "@/lib/validation/money";
import { monthBounds, summarizeAppointments } from "@/lib/modules/presentation";

export default async function FinancePage() {
  const session = await requireConfirmedSession("/app/financeiro");
  const workspace = session.workspaces[0];
  if (!workspace) return null;

  const bounds = monthBounds(todayInProductTz());
  const appointments = await loadAgendaRange(workspace.id, bounds.from, bounds.toExclusive);
  const summary = summarizeAppointments(appointments);

  return (
    <>
      <PageHeader
        eyebrow="Saúde do negócio"
        title="Financeiro"
        description="Comece pela receita real da agenda e evolua para um fluxo completo de entradas, saídas e conciliação."
        icon={CircleDollarSign}
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo financeiro">
        <MetricCard label="Receita prevista" value={formatCentsToReais(summary.expectedRevenueCents)} hint="agenda válida no mês" icon={TrendingUp} />
        <MetricCard label="Realizado" value={formatCentsToReais(summary.completedRevenueCents)} hint={`${summary.completed} atendimentos concluídos`} icon={HandCoins} tone="success" />
        <MetricCard label="A receber" value={formatCentsToReais(summary.pendingRevenueCents)} hint="agendado, confirmado ou em curso" icon={Clock3} tone="warning" />
        <MetricCard label="Lançamentos" value="—" hint="aguardando módulo remoto" icon={ReceiptText} tone="neutral" />
      </section>
      <IntegrationBanner
        title="Agenda real conectada, livro financeiro pendente"
        description="Os valores acima usam snapshots reais dos agendamentos já suportados pelo backend. Despesas, formas de pagamento, baixas e conciliação só serão ativadas após a sincronização do schema remoto."
      />
      <EmptyModuleState
        icon={ReceiptText}
        title="Lançamentos financeiros"
        description="A interface está pronta para receber as movimentações remotas sem misturar receita prevista com pagamento efetivamente recebido."
        capabilities={["Entradas e despesas categorizadas", "Baixa e situação de pagamento", "Filtros por período e profissional", "Conciliação com atendimentos e pacotes"]}
      />
    </>
  );
}
