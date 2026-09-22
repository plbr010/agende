import { Boxes, CircleAlert, PackageOpen, Search, Tags } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { IntegrationBanner } from "@/components/modules/integration-banner";
import { EmptyModuleState } from "@/components/modules/empty-module-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function InventoryPage() {
  await requireConfirmedSession("/app/estoque");

  return (
    <>
      <PageHeader
        eyebrow="Produtos e consumo"
        title="Estoque"
        description="Enxergue o que entra, o que sai e o que precisa de reposição antes de impactar seus atendimentos."
        icon={Boxes}
        actions={
          <div className="flex gap-2">
            <Input disabled placeholder="Buscar produto" className="h-11 bg-background/80" />
            <Button disabled variant="outline" className="h-11" aria-label="Buscar estoque"><Search className="size-4" /></Button>
          </div>
        }
      />
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo do estoque">
        <MetricCard label="Itens cadastrados" value="—" hint="aguardando dados remotos" icon={PackageOpen} />
        <MetricCard label="Estoque baixo" value="—" hint="alertas serão automáticos" icon={CircleAlert} tone="warning" />
        <MetricCard label="Categorias" value="—" hint="organização do catálogo" icon={Tags} tone="neutral" />
      </section>
      <IntegrationBanner description="O layout e os estados de uso estão prontos. Produtos, saldos, categorias e movimentações serão conectados somente depois de comparar o schema remoto com o Git." />
      <EmptyModuleState
        icon={Boxes}
        title="Seu estoque, sem surpresas"
        description="A estrutura visual está pronta para receber os registros existentes no Supabase sem criar uma fonte de dados paralela."
        capabilities={["Cadastro e categorização de produtos", "Entradas, saídas e ajustes de saldo", "Alertas de estoque mínimo", "Histórico de movimentações por usuário"]}
      />
    </>
  );
}
