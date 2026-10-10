import { Clock3, Search, Sparkles, WalletCards, WandSparkles } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { ServiceCatalog } from "@/components/catalog/directories";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { canManageServices, loadServices, loadTeam } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCentsToReais } from "@/lib/validation/money";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; novo?: string }>;
}) {
  const session = await requireConfirmedSession("/app/servicos");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return null;
  }
  const { q, novo } = await searchParams;
  const [services, team] = await Promise.all([
    loadServices(workspace.id, q),
    loadTeam(workspace.id),
  ]);
  const activeServices = services.filter((service) => service.active);
  const averagePrice = activeServices.length
    ? Math.round(activeServices.reduce((sum, service) => sum + service.priceCents, 0) / activeServices.length)
    : 0;
  const averageDuration = activeServices.length
    ? Math.round(activeServices.reduce((sum, service) => sum + service.durationMinutes, 0) / activeServices.length)
    : 0;

  return (
    <>
      <PageHeader
        eyebrow="O que você oferece"
        title="Serviços"
        description="O que você oferece, quanto tempo dura e o preço."
        icon={WandSparkles}
        actions={
          <form className="flex w-full gap-2 sm:w-auto sm:min-w-sm">
          <Input name="q" defaultValue={q ?? ""} placeholder="Buscar serviço" className="h-11 bg-background/80" />
          <Button type="submit" variant="outline" className="h-11 rounded-xl" aria-label="Buscar serviços">
            <Search className="size-4" /> Buscar
          </Button>
        </form>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo de serviços">
        <MetricCard label="Serviços" value={services.length} hint="serviços cadastrados" icon={Sparkles} />
        <MetricCard label="Ativos" value={activeServices.length} hint="disponíveis para agenda" icon={WandSparkles} tone="success" />
        <MetricCard label="Preço médio" value={formatCentsToReais(averagePrice)} hint="entre serviços ativos" icon={WalletCards} tone="warning" />
        <MetricCard label="Duração média" value={`${averageDuration} min`} hint="tempo por atendimento" icon={Clock3} tone="neutral" />
      </section>
      <ServiceCatalog
        services={services}
        professionals={team}
        canManage={canManageServices(workspace.role)}
        currentMemberId={team.find((member) => member.userId === session.user.id)?.memberId ?? null}
        startCreating={novo === "1"}
      />
    </>
  );
}
