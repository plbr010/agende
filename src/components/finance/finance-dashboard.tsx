"use client";
import { useState } from "react";
import type { FinancialSnapshot } from "@/lib/finance/queries";
import { formatCentsToReais } from "@/lib/validation/money";
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
export function FinanceDashboard({ snapshot }: {
    snapshot: FinancialSnapshot | null;
}) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    const [kind, setKind] = useState("all");
    if (!snapshot)
        return <p>Não foi possível carregar o financeiro. Atualize a página para tentar novamente.</p>;
    const entries = snapshot.entries.filter(e => (status === "all" || e.status === status) && (kind === "all" || e.kind === kind) && (e.title + " " + (e.clientName ?? "") + " " + e.categoryLabel).toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
    return <div className="grid gap-5">
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Dinheiro que entrou", snapshot.summary.paidRevenueCents], ["Dinheiro que saiu", snapshot.summary.paidExpenseCents], ["Ainda em aberto", snapshot.summary.pendingCents], ["Quanto sobrou", snapshot.summary.balanceCents]].map(([label, value]) => <div key={label} className="rounded-2xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-serif text-2xl">{formatCentsToReais(Number(value))}</p>
        </div>)}</section>
 <div className="grid gap-3 sm:grid-cols-2">{(["income", "expense"] as const).map(type => <ActionPanel key={type} title={type === "income" ? "Adicionar dinheiro que entrou" : "Adicionar dinheiro que saiu"}>
        <ManagementForm action="finance-create" label="Salvar" idempotent>
        <input type="hidden" name="kind" value={type}/>
        <Field name="description" label="O que foi"/>
        <Field name="amount" label="Valor (R$)"/>
        <Field name="due" label="Data" type="date"/>
        <SelectField label="Categoria" name="category" value="">
        <option value="">Sem categoria</option>{snapshot.categories.filter(c => c.active && !c.archivedAt && c.kind === type).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</SelectField>
        </ManagementForm>
        </ActionPanel>)}</div>
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
 {!entries.length && <p className="rounded-2xl bg-secondary p-5">Nada encontrado. Toque em Adicionar dinheiro que entrou ou saiu, ou mude o período.</p>}
 {entries.map(e => <article key={e.id} className="grid gap-3 rounded-2xl border bg-card p-5">
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
        <p className="text-sm">Data: {e.dueDate?.split("-").reverse().join("/") ?? "Não informado"}{e.paymentMethodLabel && " · " + e.paymentMethodLabel}{e.refundedCents > 0 && " · Devolvido: " + formatCentsToReais(e.refundedCents)}</p>
 {e.status === "pending" && <>
            <ActionPanel title="Marcar como pago">
            <ManagementForm action="finance-paid" id={e.id} label="Confirmar pagamento" confirm={"Confirmar pagamento de " + formatCentsToReais(e.amountCents) + "?"}>
            <PaymentField />
            </ManagementForm>
            </ActionPanel>
            <ManagementForm action="finance-cancel" id={e.id} label="Cancelar este registro" confirm="Cancelar este registro?"/>
            </>}
 {e.status === "cancelled" && <ManagementForm action="finance-reopen" id={e.id} label="Desfazer cancelamento" confirm="Desfazer o cancelamento deste registro?"/>}
 {e.status === "paid" && e.kind === "income" && e.refundedCents < e.amountCents && <ActionPanel title="Registrar devolução">
            <ManagementForm action="finance-refund" id={e.id} label="Confirmar devolução" idempotent confirm="Confirmar a devolução? Confira valor, motivo e forma de pagamento.">
            <p className="text-sm">Ainda dá para devolver {formatCentsToReais(e.amountCents - e.refundedCents)}. Isto só anota a devolução no Agendê. Se for um pacote inteiro, as sessões que faltam podem ser canceladas.</p>
            <Field label="Valor devolvido (R$)" name="amount"/>
            <Field label="Motivo da devolução" name="reason"/>
            <PaymentField />
            <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="confirmed" required className="size-5"/> Confirmei o valor e o motivo da devolução.</label>
            </ManagementForm>
            </ActionPanel>}
 </article>)}</div>;
}
