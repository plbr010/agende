"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Boxes, ChartNoAxesCombined, CircleDollarSign, PackageCheck, PackageMinus, Wallet, WandSparkles } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { PeriodSelector } from "@/components/modules/period-selector";
import { AdvancedReportDashboard } from "@/components/reports/advanced-report-dashboard";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/components/demo/demo-provider";
import { DEMO_PACKAGE, DEMO_PRODUCTS } from "@/lib/demo/catalog";
import { DEMO_MOVEMENTS, demoEntries, demoReport, entriesInPeriod, financeSummary, inventorySummary, movementWhen } from "@/lib/demo/project";
import type { DemoPaymentMethod } from "@/lib/demo/session";
import { resolvePeriod } from "@/lib/modules/periods";
import { formatCentsToReais } from "@/lib/validation/money";

const METHODS: Array<[DemoPaymentMethod, string]> = [
  ["pix", "Pix"],
  ["cash", "Dinheiro"],
  ["debit_card", "Cartão de débito"],
  ["credit_card", "Cartão de crédito"],
  ["bank_transfer", "Transferência"],
  ["other", "Outro"],
];

export function DemoFinance() {
  const demo = useDemo();
  const params = useSearchParams();
  const period = resolvePeriod(params.get("period") ?? undefined, demo.today);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [method, setMethod] = useState<DemoPaymentMethod>("pix");
  const entries = useMemo(
    () => entriesInPeriod(demoEntries(demo.today, demo.session, demo.appointments), period.startDate, period.endDate),
    [demo, period.startDate, period.endDate],
  );
  const summary = financeSummary(entries);
  const visible = entries.filter((entry) => (status === "all" || entry.status === status) && (kind === "all" || entry.kind === kind) && `${entry.title} ${entry.clientName ?? ""} ${entry.categoryLabel}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));

  return (
    <>
      <PageHeader eyebrow="Dinheiro do salão" title="Financeiro" description="O que entrou, o que saiu e o que ainda está em aberto neste estúdio fictício." icon={CircleDollarSign} />
      <PeriodSelector {...period} />
      <p className="rounded-2xl bg-metric-ivory px-4 py-3 text-sm leading-6 text-muted-foreground">Lançamentos novos ficam desligados. Um atendimento concluído nesta sessão aparece como entrada pendente, no mesmo momento em que o Agendê cria essa entrada. Marcar como recebido também fica só aqui.</p>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumo do dinheiro">
        <MetricCard label="Dinheiro que entrou" value={formatCentsToReais(summary.paidRevenueCents)} hint="já recebido neste período" icon={CircleDollarSign} tone="success" />
        <MetricCard label="Dinheiro que saiu" value={formatCentsToReais(summary.paidExpenseCents)} hint="já pago neste período" icon={Wallet} />
        <MetricCard label="Ainda em aberto" value={formatCentsToReais(summary.pendingCents)} hint="falta entrar ou sair" icon={CircleDollarSign} tone="warning" />
        <MetricCard label="Quanto sobrou" value={formatCentsToReais(summary.balanceCents)} hint="entradas menos saídas" icon={Wallet} tone="neutral" />
      </section>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">Buscar<input className="h-11 rounded-xl border border-input bg-background px-3" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou descrição" /></label>
        <label className="grid gap-1 text-sm">Situação<select className="h-11 rounded-xl border border-input bg-background px-3" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todas</option><option value="pending">Ainda não entrou ou saiu</option><option value="paid">Já entrou ou saiu</option></select></label>
        <label className="grid gap-1 text-sm">Tipo<select className="h-11 rounded-xl border border-input bg-background px-3" value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Todos</option><option value="income">Dinheiro que entrou</option><option value="expense">Dinheiro que saiu</option></select></label>
      </div>
      {visible.length === 0 ? <div className="agende-panel rounded-[1.5rem] ring-1 ring-[#f0e4de]"><EmptyState icon={Wallet} title="Nada encontrado" description="Nada neste período com os filtros escolhidos." /></div> : null}
      {visible.map((entry) => (
        <article key={entry.id} className={"agende-shadow grid gap-3 rounded-3xl border bg-card p-5 " + (entry.kind === "income" ? "border-l-4 border-l-success" : "border-l-4 border-l-primary")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">{entry.title}</h2>
              <p className="text-sm text-muted-foreground">{entry.categoryLabel}{entry.clientName ? ` · ${entry.clientName}` : ""} · {entry.dueDate.split("-").reverse().join("/")}</p>
            </div>
            <p className="font-serif text-2xl text-wine-deep">{formatCentsToReais(entry.amountCents)}</p>
          </div>
          <p className="text-sm">{entry.status === "paid" ? `Já ${entry.kind === "income" ? "entrou" : "saiu"}${entry.paymentMethodLabel ? ` · ${entry.paymentMethodLabel}` : ""}` : entry.kind === "income" ? "Ainda vai entrar" : "Ainda vai sair"}</p>
          {entry.status === "pending" ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-sm">Como recebeu ou pagou
                <select className="h-11 rounded-xl border border-input bg-background px-3" value={method} onChange={(event) => setMethod(event.target.value as DemoPaymentMethod)}>
                  {METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <Button type="button" className="h-11" onClick={() => demo.markPaid(entry.id, method)}>{entry.kind === "income" ? "Marcar como recebido" : "Marcar como pago"}</Button>
            </div>
          ) : null}
        </article>
      ))}
    </>
  );
}

export function DemoInventory() {
  const demo = useDemo();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const summary = inventorySummary();
  const products = DEMO_PRODUCTS.filter((product) => product.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")) && (filter === "all" || (filter === "low" ? product.quantity > 0 && product.quantity <= product.minimumQuantity : product.quantity === 0)));
  return (
    <>
      <PageHeader eyebrow="Produtos e consumo" title="Estoque" description="Produtos fictícios. Entrada, saída e correção ficam desligadas para não alterar estoque real." icon={Boxes} />
      <div className="grid gap-3 sm:grid-cols-3" aria-label="Resumo do estoque">
        <MetricCard label="Produtos" value={summary.products} hint="cadastrados e ativos" icon={Boxes} />
        <MetricCard label="Estoque baixo" value={summary.lowStock} hint="precisa repor em breve" icon={PackageMinus} tone="warning" />
        <MetricCard label="Custo em estoque" value={formatCentsToReais(summary.estimatedCostCents)} hint="estimativa do que está na prateleira" icon={Wallet} tone="neutral" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Buscar produto<input className="h-11 rounded-xl border border-input bg-background px-3" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome do produto" /></label>
        <label className="grid gap-1 text-sm">Exibir<select className="h-11 rounded-xl border border-input bg-background px-3" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todos</option><option value="low">Estoque baixo</option><option value="zero">Sem estoque</option></select></label>
      </div>
      {products.length === 0 ? <div className="agende-panel rounded-[1.5rem] ring-1 ring-[#f0e4de]"><EmptyState icon={Boxes} title="Nenhum produto encontrado" description="Ajuste a busca ou o filtro." /></div> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {products.map((product) => (
          <article key={product.id} className="agende-shadow grid gap-2 rounded-3xl border border-primary/10 bg-card p-5">
            <h2 className="text-lg font-semibold">{product.name}</h2>
            <p>{product.quantity} {product.unit} · Mínimo {product.minimumQuantity} · <strong>{product.quantity === 0 ? "Sem estoque" : product.quantity <= product.minimumQuantity ? "Baixo" : "Normal"}</strong></p>
            <p className="text-sm text-muted-foreground">{product.costCents === null ? "Custo não informado" : formatCentsToReais(product.costCents)}</p>
          </article>
        ))}
      </div>
      <section className="agende-shadow rounded-3xl border border-primary/10 bg-card p-5">
        <h2 className="mb-4 text-xl font-semibold">Histórico recente</h2>
        {DEMO_MOVEMENTS.map((movement) => (
          <div key={movement.id} className="flex justify-between gap-4 border-b py-3">
            <div>
              <p>{movement.productName} · {movement.label}</p>
              <p className="text-xs text-muted-foreground">{new Date(movementWhen(demo.today, movement.daysBeforeToday)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {movement.note}</p>
            </div>
            <strong>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}</strong>
          </div>
        ))}
      </section>
    </>
  );
}

export function DemoPackages() {
  const demo = useDemo();
  const used = demo.appointments.filter((item) => item.settledByPackage && item.status === "completed").length;
  return (
    <>
      <PageHeader eyebrow="Combos" title="Pacotes" description="Um pacote fictício e a venda já registrada. Criar ou vender pacote fica desligado na demonstração." icon={PackageCheck} />
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="agende-shadow rounded-3xl border border-primary/10 bg-card p-5">
          <WandSparkles className="size-5 text-wine-deep" aria-hidden="true" />
          <h2 className="mt-2 text-xl font-semibold">{DEMO_PACKAGE.name}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{DEMO_PACKAGE.description}</p>
          <p className="mt-3 font-medium">{formatCentsToReais(DEMO_PACKAGE.priceCents)} · {DEMO_PACKAGE.validityDays} dias</p>
          <p className="mt-2 text-sm">{DEMO_PACKAGE.serviceName} · {DEMO_PACKAGE.sessions} sessões</p>
        </article>
      </div>
      <section className="grid gap-3">
        <h2 className="font-serif text-xl text-wine-deep">Pacotes dos clientes</h2>
        <article className="agende-shadow rounded-3xl border border-primary/10 bg-card p-5">
          <h3 className="font-semibold">{DEMO_PACKAGE.clientName} · {DEMO_PACKAGE.name}</h3>
          <p className="mt-2 text-sm">Ativo · {used} usadas / {Math.max(0, DEMO_PACKAGE.sessions - used)} restantes</p>
          <p className="text-sm text-muted-foreground">{formatCentsToReais(DEMO_PACKAGE.priceCents)} · a venda entrou no financeiro como pacote, não como serviço avulso.</p>
        </article>
      </section>
    </>
  );
}

export function DemoReports() {
  const demo = useDemo();
  const params = useSearchParams();
  const period = resolvePeriod(params.get("period") ?? undefined, demo.today);
  const report = demoReport(demo.today, demo.appointments, demoEntries(demo.today, demo.session, demo.appointments), period);
  return (
    <>
      <PageHeader eyebrow="Números do mês" title="Relatórios" description="Indicadores calculados com os mesmos horários e lançamentos fictícios das outras telas." icon={ChartNoAxesCombined} />
      <PeriodSelector {...period} />
      <AdvancedReportDashboard report={report} />
    </>
  );
}
