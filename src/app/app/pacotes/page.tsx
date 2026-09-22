import { BadgePercent, PackageCheck, Sparkles, TicketCheck } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { IntegrationBanner } from "@/components/modules/integration-banner";
import { EmptyModuleState } from "@/components/modules/empty-module-state";

export default async function PackagesPage() {
  await requireConfirmedSession("/app/pacotes");

  return (
    <>
      <PageHeader
        eyebrow="Fidelização"
        title="Pacotes"
        description="Crie combinações de serviços que valorizam seu trabalho e ajudam clientes a manter uma rotina de cuidado."
        icon={PackageCheck}
      />
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo dos pacotes">
        <MetricCard label="Pacotes ativos" value="—" hint="aguardando dados remotos" icon={PackageCheck} />
        <MetricCard label="Créditos em uso" value="—" hint="sessões disponíveis" icon={TicketCheck} tone="success" />
        <MetricCard label="Economia oferecida" value="—" hint="benefício médio" icon={BadgePercent} tone="warning" />
      </section>
      <IntegrationBanner description="A jornada de catálogo, venda e consumo está desenhada. A conexão ficará pendente até conhecermos os nomes, relacionamentos e regras reais das migrations remotas." />
      <EmptyModuleState
        icon={Sparkles}
        title="Transforme serviços em experiências"
        description="A vitrine de pacotes poderá ser ativada assim que os contratos reais do banco forem sincronizados."
        capabilities={["Combinação de múltiplos serviços", "Preço, validade e limite de sessões", "Acompanhamento de créditos por cliente", "Histórico de consumo e expiração"]}
      />
    </>
  );
}
