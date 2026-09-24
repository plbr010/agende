import { BadgePercent, CalendarClock, PackageCheck, TicketCheck, Undo2, UsersRound } from "lucide-react";
import { MetricCard } from "@/components/app/metric-card";
import { BackendContractNotice } from "@/components/modules/backend-contract-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PackagesSnapshot } from "@/lib/packages/queries";
import { summarizePackages } from "@/lib/packages/queries";
import { formatCentsToReais } from "@/lib/validation/money";

export function PackagesDashboard({ snapshot }: { snapshot: PackagesSnapshot | null }) {
  if (!snapshot) {
    return (
      <BackendContractNotice
        title="Jornada de pacotes pronta para o contrato real"
        description="Catálogo, venda, consumo e reversão já têm uma fronteira única de dados. As ações ficam indisponíveis até os RPCs e regras reais serem conhecidos."
        fields={["Catálogo e validade", "Venda vinculada à cliente", "Sessões incluídas e usadas", "Expiração e reversão"]}
      />
    );
  }

  const summary = summarizePackages(snapshot);

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo real dos pacotes">
        <MetricCard label="Pacotes ativos" value={summary.activeCatalogItems} hint="itens disponíveis no catálogo" icon={PackageCheck} />
        <MetricCard label="Vendas ativas" value={summary.activeSales} hint="não expiradas ou revertidas" icon={UsersRound} tone="success" />
        <MetricCard label="Sessões restantes" value={summary.remainingSessions} hint="créditos ainda utilizáveis" icon={TicketCheck} tone="warning" />
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><BadgePercent className="size-5 text-primary" /> Catálogo</CardTitle><CardDescription>Composição, preço e validade definidos no backend.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            {snapshot.catalog.map((item) => (
              <article key={item.id} className="rounded-2xl bg-secondary/45 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.sessions.map((session) => `${session.included}× ${session.serviceName}`).join(" · ")}</p></div><Badge variant={item.active ? "secondary" : "outline"}>{item.active ? "Ativo" : "Inativo"}</Badge></div>
                <div className="mt-3 flex items-center justify-between text-sm"><span>{formatCentsToReais(item.priceCents)}</span><span className="text-muted-foreground">{item.validityDays ? `${item.validityDays} dias` : "Sem expiração definida"}</span></div>
              </article>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><CalendarClock className="size-5 text-primary" /> Pacotes de clientes</CardTitle><CardDescription>Consumo, validade e reversões retornados pelo backend.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            {snapshot.sales.map((sale) => {
              const statusLabel = { active: "Ativo", exhausted: "Esgotado", cancelled: "Cancelado", expired: "Expirado" }[sale.status];
              return (
                <article key={sale.id} className="rounded-2xl border border-border/70 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{sale.clientName}</p><p className="text-xs text-muted-foreground">{sale.packageName}</p></div><Badge variant={sale.status === "cancelled" ? "destructive" : "outline"}>{statusLabel}</Badge></div>
                  <div className="mt-3 flex items-center justify-between text-sm"><span>{sale.usedTotal} de {sale.includedTotal} sessões usadas</span>{sale.status === "cancelled" ? <span className="flex items-center gap-1 text-destructive"><Undo2 className="size-3.5" /> Cancelado</span> : null}</div>
                </article>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
