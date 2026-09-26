"use client";
import { useState } from "react";
import type { FinancialSnapshot } from "@/lib/finance/queries";
import { formatCentsToReais } from "@/lib/validation/money";
import { ManagementForm, Field, SelectField, ActionPanel } from "@/components/modules/management-form";
const statuses = { pending: "Pendente", paid: "Pago", cancelled: "Cancelado" };
function PaymentField() {
    return <SelectField label="Forma de pagamento" name="method">
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
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Receitas pagas", snapshot.summary.paidRevenueCents], ["Despesas pagas", snapshot.summary.paidExpenseCents], ["Pendente", snapshot.summary.pendingCents], ["Saldo líquido", snapshot.summary.balanceCents]].map(([label, value]) => <div key={label} className="rounded-2xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-serif text-2xl">{formatCentsToReais(Number(value))}</p>
        </div>)}</section>
 <div className="grid gap-3 sm:grid-cols-2">{(["income", "expense"] as const).map(type => <ActionPanel key={type} title={type === "income" ? "+ Receita" : "+ Despesa"}>
        <ManagementForm action="finance-create" label="Salvar lançamento" idempotent>
        <input type="hidden" name="kind" value={type}/>
        <Field name="description" label="Descrição"/>
        <Field name="amount" label="Valor (R$)"/>
        <Field name="due" label="Vencimento" type="date"/>
        <SelectField label="Categoria" name="category" value="">
        <option value="">Sem categoria</option>{snapshot.categories.filter(c => c.active && !c.archivedAt && c.kind === type).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</SelectField>
        </ManagementForm>
        </ActionPanel>)}</div>
 <div className="flex flex-wrap gap-3">
    <p className="text-sm text-muted-foreground">Últimos 100 lançamentos criados no período. A busca e os filtros se aplicam à lista exibida.</p><label>Buscar<input className="ml-2 rounded-lg border p-2" value={search} onChange={e => setSearch(e.target.value)}/>
    </label>
    <label>Situação<select className="ml-2 rounded-lg border p-2" value={status} onChange={e => setStatus(e.target.value)}>
    <option value="all">Todas</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    </label>
    <label>Tipo<select className="ml-2 rounded-lg border p-2" value={kind} onChange={e => setKind(e.target.value)}>
    <option value="all">Todos</option>
    <option value="income">Receita</option>
    <option value="expense">Despesa</option>
    </select>
    </label>
    </div>
 {!entries.length && <p className="rounded-2xl bg-secondary p-5">Nenhum lançamento encontrado. Registre uma receita ou despesa, ou ajuste o período e os filtros.</p>}
 {entries.map(e => <article key={e.id} className="grid gap-3 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap justify-between gap-3">
        <div>
        <h2 className="font-semibold">{e.title}</h2>
        <p className="text-sm text-muted-foreground">{e.kind === "income" ? "Receita" : "Despesa"} · {e.categoryLabel} · {e.clientName}</p>
        </div>
        <div>
        <strong>{formatCentsToReais(e.amountCents)}</strong>
        <p>{statuses[e.status]}</p>
        </div>
        </div>
        <p className="text-sm">Vencimento: {e.dueDate?.split("-").reverse().join("/") ?? "Não informado"}{e.paymentMethodLabel && " · " + e.paymentMethodLabel}{e.refundedCents > 0 && " · Devolvido: " + formatCentsToReais(e.refundedCents)}</p>
 {e.status === "pending" && <>
            <ActionPanel title="Dar baixa">
            <ManagementForm action="finance-paid" id={e.id} label="Confirmar pagamento" confirm={"Confirmar pagamento de " + formatCentsToReais(e.amountCents) + "?"}>
            <PaymentField />
            </ManagementForm>
            </ActionPanel>
            <ManagementForm action="finance-cancel" id={e.id} label="Cancelar lançamento" confirm="Cancelar este lançamento?"/>
            </>}
 {e.status === "cancelled" && <ManagementForm action="finance-reopen" id={e.id} label="Reabrir" confirm="Solicitar reabertura deste lançamento?"/>}
 {e.status === "paid" && e.kind === "income" && e.refundedCents < e.amountCents && <ActionPanel title="Registrar devolução">
            <ManagementForm action="finance-refund" id={e.id} label="Confirmar devolução" idempotent confirm="Confirmar o registro da devolução? Confira valor, motivo e forma de pagamento.">
            <p className="text-sm">Disponível: {formatCentsToReais(e.amountCents - e.refundedCents)}. Este registro não transfere dinheiro. Uma devolução integral de pacote pode cancelar as sessões restantes.</p>
            <Field label="Valor devolvido (R$)" name="amount"/>
            <Field label="Motivo da devolução" name="reason"/>
            <PaymentField />
            <label className="text-sm">
            <input type="checkbox" name="confirmed" required/> Confirmo que conferi a devolução e seus efeitos.</label>
            </ManagementForm>
            </ActionPanel>}
 </article>)}</div>;
}
