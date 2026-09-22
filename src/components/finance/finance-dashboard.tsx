import { CircleDollarSign, Clock3, HandCoins, ReceiptText, RotateCcw, TrendingDown } from "lucide-react";
import { MetricCard } from "@/components/app/metric-card";
import { BackendContractNotice } from "@/components/modules/backend-contract-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinancialSnapshot } from "@/lib/finance/queries";
import { formatCentsToReais } from "@/lib/validation/money";

const statusLabel = { pending: "Pendente", paid: "Pago", cancelled: "Cancelado" } as const;

export function FinanceDashboard({ snapshot }: { snapshot: FinancialSnapshot | null }) {
  if (!snapshot) {
    return <BackendContractNotice title="Livro financeiro pronto para o contrato real" description="Valores da agenda não são mais usados como substituto do financeiro. O painel será preenchido apenas pela resposta contábil do backend." fields={["Receitas e despesas", "Pending, paid e cancelled", "Categorias e formas de pagamento", "Reembolsos com idempotência"]} />;
  }
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo financeiro real">
        <MetricCard label="Receitas pagas" value={formatCentsToReais(snapshot.summary.paidRevenueCents)} hint="confirmadas pelo financeiro" icon={HandCoins} tone="success" />
        <MetricCard label="Despesas pagas" value={formatCentsToReais(snapshot.summary.paidExpenseCents)} hint="saídas confirmadas" icon={TrendingDown} tone="warning" />
        <MetricCard label="Pendentes" value={formatCentsToReais(snapshot.summary.pendingCents)} hint="aguardando baixa" icon={Clock3} />
        <MetricCard label="Saldo" value={formatCentsToReais(snapshot.summary.balanceCents)} hint={`${formatCentsToReais(snapshot.summary.refundedCents)} reembolsados`} icon={CircleDollarSign} tone="neutral" />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><ReceiptText className="size-5 text-primary" /> Lançamentos</CardTitle><CardDescription>Entradas e saídas retornadas pelo livro financeiro.</CardDescription></CardHeader><CardContent className="grid gap-2">{snapshot.entries.map((entry) => <article key={entry.id} className="grid gap-2 rounded-2xl bg-secondary/45 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="font-medium">{entry.title}</p><p className="text-xs text-muted-foreground">{entry.categoryLabel}{entry.paymentMethodLabel ? ` · ${entry.paymentMethodLabel}` : ""}</p></div><Badge variant={entry.status === "cancelled" ? "destructive" : "outline"}>{statusLabel[entry.status]}</Badge><span className={entry.kind === "expense" ? "font-medium text-destructive" : "font-medium text-primary"}>{entry.kind === "expense" ? "−" : "+"}{formatCentsToReais(entry.amountCents)}</span></article>)}</CardContent></Card>
        <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><RotateCcw className="size-5 text-primary" /> Reembolsos</CardTitle><CardDescription>Operações rastreadas pelo backend.</CardDescription></CardHeader><CardContent className="grid gap-2">{snapshot.refunds.map((refund) => <article key={refund.id} className="rounded-2xl border border-border/70 p-4"><p className="font-medium">{formatCentsToReais(refund.amountCents)}</p><p className="mt-1 text-xs text-muted-foreground">{refund.reason ?? "Sem motivo informado"}</p></article>)}</CardContent></Card>
      </section>
    </>
  );
}
