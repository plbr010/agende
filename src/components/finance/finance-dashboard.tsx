"use client";
import { useState } from "react";
import { CircleDollarSign, Clock3, ReceiptText, Wallet } from "lucide-react";
import { entryDateLabel } from "@/lib/finance/entry-date";
import type { FinancialSnapshot } from "@/lib/finance/queries";
import { formatCentsToReais } from "@/lib/validation/money";
import { EmptyState } from "@/components/app/empty-state";
import { MetricCard } from "@/components/app/metric-card";
import { ManagementForm, Field, SelectField, ActionPanel } from "@/components/modules/management-form";
const statusFilters = [
  ["pending", "Ainda não entrou ou saiu"],
  ["paid", "Já entrou ou saiu"],
  ["cancelled", "Cancelado"],
] as const;

function entryStatusLabel(kind: "income" | "expense", status: "pending" | "paid" | "cancelled") {
  if (status === "cancelled") return "Cancelado";
  if (status === "paid") return kind === "income" ? "Já entrou" : "Já saiu";
  return kind === "income" ? "Ainda vai entrar" : "Ainda vai sair";
}
function PaymentField() {
    return <SelectField label="Como recebeu ou pagou" name="method">
    <option value="pix">Pix</option>
    <option value="cash">Dinheiro</option>
    <option value="debit_card">Cartão de débito</option>
    <option value="credit_card">Cartão de crédito</option>
    <option value="bank_transfer">Transferência</option>
    <option value="other">Outro</option>
    </SelectField>;
}
export function FinanceDashboard({ snapshot, canManage, canReceive, timezone }: {
    snapshot: FinancialSnapshot | null;
    canManage: boolean;
    canReceive: boolean;
    timezone: string;
}) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    const [kind, setKind] = useState("all");
    if (!snapshot)
        return <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">Não foi possível carregar o financeiro. Atualize a página para tentar novamente.</p>;
    const entries = snapshot.entries.filter(e => (status === "all" || e.status === status) && (kind === "all" || e.kind === kind) && (e.title + " " + (e.clientName ?? "") + " " + e.categoryLabel).toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
    return <div className="grid gap-5">
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumo do dinheiro">
        <MetricCard label="Dinheiro que entrou" value={formatCentsToReais(snapshot.summary.paidRevenueCents)} hint="já recebido neste período" icon={CircleDollarSign} tone="success" />
        <MetricCard label="Dinheiro que saiu" value={formatCentsToReais(snapshot.summary.paidExpenseCents)} hint="já pago neste período" icon={ReceiptText} />
        <MetricCard label="Ainda em aberto" value={formatCentsToReais(snapshot.summary.pendingCents)} hint="saldo atual dos registros até o fim do período" icon={Clock3} tone="warning" />
        <MetricCard label="Quanto sobrou" value={formatCentsToReais(snapshot.summary.balanceCents)} hint="entradas menos saídas" icon={Wallet} tone="neutral" />
    </section>
 {canManage && <div className="grid gap-3 sm:grid-cols-2">{(["income", "expense"] as const).map(type => <ActionPanel key={type} title={type === "income" ? "Adicionar dinheiro que entrou" : "Adicionar dinheiro que saiu"}>
        <ManagementForm action="finance-create" label="Salvar" idempotent>
        <input type="hidden" name="kind" value={type}/>
        <Field name="description" label="O que foi"/>
        <Field name="amount" label="Valor (R$)"/>
        <Field name="due" label="Data" type="date"/>
        <SelectField label="Categoria" name="category" value="">
        <option value="">Sem categoria</option>{snapshot.categories.filter(c => c.active && !c.archivedAt && c.kind === type).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</SelectField>
        </ManagementForm>
        </ActionPanel>)}</div>}
 <div className="grid gap-3 sm:grid-cols-3">
    <p className="text-sm text-muted-foreground sm:col-span-3">Mostramos os registros mais recentes deste período. Use a busca para achar um nome ou valor.</p>
    <label className="grid gap-1 text-sm">Buscar
      <input className="h-11 rounded-xl border border-input bg-background px-3" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou descrição"/>
    </label>
    <label className="grid gap-1 text-sm">Situação
      <select className="h-11 rounded-xl border border-input bg-background px-3" value={status} onChange={e => setStatus(e.target.value)}>
    <option value="all">Todas</option>{statusFilters.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    </label>
    <label className="grid gap-1 text-sm">Tipo
      <select className="h-11 rounded-xl border border-input bg-background px-3" value={kind} onChange={e => setKind(e.target.value)}>
    <option value="all">Todos</option>
    <option value="income">Dinheiro que entrou</option>
    <option value="expense">Dinheiro que saiu</option>
    </select>
    </label>
    </div>
 {!entries.length && (
        <div className="agende-panel rounded-[1.5rem] ring-1 ring-[#f0e4de]">
            <EmptyState icon={Wallet} title="Nada encontrado" description="Nada encontrado. Toque em Adicionar dinheiro que entrou ou saiu, ou mude o período." />
        </div>
    )}
 {entries.map(e => <article key={e.id} className={"agende-shadow grid gap-3 rounded-3xl border bg-card p-5 " + (e.kind === "income" ? "border-l-4 border-l-success" : "border-l-4 border-l-primary")}>
        <div className="flex flex-wrap justify-between gap-3">
        <div>
        <h2 className="font-semibold">{e.title}</h2>
        <p className="text-sm text-muted-foreground">{e.kind === "income" ? "Entrada" : "Saída"} · {e.categoryLabel} · {e.clientName}</p>
        </div>
        <div>
        <strong>{formatCentsToReais(e.amountCents)}</strong>
        <p>{entryStatusLabel(e.kind, e.status)}</p>
        </div>
        </div>
        <p className="text-sm">Data: {entryDateLabel(e.dueDate, e.paidAt, timezone)}{e.paymentMethodLabel && " · " + e.paymentMethodLabel}{e.kind === "income" && " · Recebido: " + formatCentsToReais(e.receivedCents)}{e.refundedCents > 0 && " · Devolvido: " + formatCentsToReais(e.refundedCents)}{e.kind === "income" && " · Líquido recebido: " + formatCentsToReais(Math.max(e.receivedCents - e.refundedCents, 0))}{e.status === "pending" && " · Pendente: " + formatCentsToReais(Math.max(e.amountCents - e.receivedCents, 0))}</p>
 {e.status === "pending" && (e.kind === "income" ? canReceive : canManage) && <>
            <ActionPanel title="Marcar como pago">
            <ManagementForm action="finance-paid" id={e.id} label="Confirmar pagamento" idempotent confirm={"Confirmar recebimento/pagamento do saldo de " + formatCentsToReais(Math.max(e.amountCents - e.receivedCents, 0)) + "?"}>
            <PaymentField />
            </ManagementForm>
            </ActionPanel>
            {canManage && <ManagementForm action="finance-cancel" id={e.id} label="Cancelar este registro" confirm="Cancelar este registro?"/>}
            </>}
 {canManage && e.status === "cancelled" && !e.packageReceivableLocked && <ManagementForm action="finance-reopen" id={e.id} label="Desfazer cancelamento" confirm="Desfazer o cancelamento deste registro?"/>}
 {e.packageReceivableLocked ? <p className="text-sm">Recebível encerrado por pacote. Uma nova cobrança exige lançamento manual.</p> : null}
 {e.commissionCashLocked ? <p className="text-sm">Movimento vinculado à comissão. Registre pagamentos e devoluções na tela de comissões.</p> : null}
 {canManage && !e.commissionCashLocked && e.status !== "cancelled" && e.kind === "income" && e.refundedCents < e.receivedCents && <ActionPanel title="Registrar devolução">
            <ManagementForm action="finance-refund" id={e.id} label="Confirmar devolução" idempotent confirm="Confirmar a devolução? Confira valor, motivo e forma de pagamento.">
            <p className="text-sm">Ainda dá para devolver {formatCentsToReais(e.receivedCents - e.refundedCents)}. Isto só anota a devolução no Agendê. Se for um pacote inteiro, as sessões que faltam podem ser canceladas.</p>
            <Field label="Valor devolvido (R$)" name="amount"/>
            <Field label="Motivo da devolução" name="reason"/>
            <PaymentField />
            <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="confirmed" required className="size-5"/> Confirmei o valor e o motivo da devolução.</label>
            </ManagementForm>
            </ActionPanel>}
 </article>)}</div>;
}
