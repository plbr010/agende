import { Boxes, CircleAlert, History, PackageOpen, WalletCards } from "lucide-react";
import { BackendContractNotice } from "@/components/modules/backend-contract-notice";
import { MetricCard } from "@/components/app/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InventorySnapshot } from "@/lib/inventory/queries";
import { summarizeInventory } from "@/lib/inventory/queries";
import { formatCentsToReais } from "@/lib/validation/money";

export function InventoryDashboard({ snapshot }: { snapshot: InventorySnapshot | null }) {
  if (!snapshot) {
    return (
      <BackendContractNotice
        title="Contrato de estoque pronto para conexão"
        description="A tela não exibe saldos simulados. Assim que o adaptador remoto for mapeado, produtos e movimentações entram neste mesmo fluxo validado."
        fields={["Produtos e quantidades", "Estoque mínimo", "Custo por unidade", "Movimentações recentes"]}
      />
    );
  }

  const summary = summarizeInventory(snapshot);

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo real do estoque">
        <MetricCard label="Produtos" value={summary.products} hint="itens retornados pelo backend" icon={PackageOpen} />
        <MetricCard label="Estoque baixo" value={summary.lowStock} hint={`${summary.outOfStock} sem saldo`} icon={CircleAlert} tone="warning" />
        <MetricCard label="Custo em estoque" value={formatCentsToReais(summary.estimatedCostCents)} hint="estimativa do backend" icon={WalletCards} tone="neutral" />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Boxes className="size-5 text-primary" /> Produtos</CardTitle><CardDescription>Saldo, ponto de reposição e custo real.</CardDescription></CardHeader>
          <CardContent className="grid gap-2">
            {snapshot.products.map((product) => {
              const low = product.quantity <= product.minimumQuantity;
              return (
                <article key={product.id} className="grid gap-3 rounded-2xl bg-secondary/45 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div><p className="font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.costCents === null ? "Custo não informado" : `Custo ${formatCentsToReais(product.costCents)}`}</p></div>
                  <div className="text-sm"><span className="font-serif text-2xl">{product.quantity}</span> em estoque</div>
                  <Badge variant={low ? "destructive" : "secondary"}>{low ? "Repor" : `Mín. ${product.minimumQuantity}`}</Badge>
                </article>
              );
            })}
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><History className="size-5 text-primary" /> Movimentações</CardTitle><CardDescription>Últimas alterações recebidas do backend.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            {snapshot.recentMovements.map((movement) => (
              <article key={movement.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border/70 p-4">
                <div><p className="font-medium">{movement.productName}</p><p className="text-xs text-muted-foreground">{movement.label}</p></div>
                <span className={movement.quantityDelta < 0 ? "font-medium text-destructive" : "font-medium text-primary"}>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}</span>
              </article>
            ))}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
