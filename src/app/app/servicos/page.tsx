import { Clock3, Search, Sparkles, WalletCards, WandSparkles } from "lucide-react";
import { requireActiveWorkspace, requireConfirmedSession } from "@/lib/auth/session";
import { ServiceCatalog } from "@/components/catalog/directories";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { canManageServices, loadServiceCatalog, loadTeamCatalog } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCentsToReais } from "@/lib/validation/money";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; novo?: string }>;
}) {
  const session = await requireConfirmedSession("/app/servicos");
  const workspace = requireActiveWorkspace(session);
  const { q, novo } = await searchParams;
  const [catalog, team] = await Promise.all([
    loadServiceCatalog(workspace.id, q),
    loadTeamCatalog(workspace.id),
  ]);
  const services = catalog.services;
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
      />
      <form className="agende-panel grid gap-3 rounded-[1.5rem] p-4 ring-1 ring-[#f0e4de] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-5">
        <div className="grid gap-2">
          <Label htmlFor="service-search">Buscar pelo nome</Label>
          <Input id="service-search" name="q" defaultValue={q ?? ""} placeholder="Ex.: manicure, escova" className="h-11 bg-white" />
        </div>
        <Button type="submit" variant="outline" className="h-11 rounded-full" aria-label="Buscar serviços">
          <Search className="size-4" /> Buscar
        </Button>
      </form>
      {catalog.error ? null : (
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo de serviços">
        <MetricCard label="Serviços" value={services.length} hint={q ? "no resultado da busca" : "serviços cadastrados"} icon={Sparkles} />
        <MetricCard label="Ativos" value={activeServices.length} hint="disponíveis para agenda" icon={WandSparkles} tone="success" />
        <MetricCard label="Preço médio" value={formatCentsToReais(averagePrice)} hint="entre serviços ativos" icon={WalletCards} tone="warning" />
        <MetricCard label="Duração média" value={`${averageDuration} min`} hint="tempo por atendimento" icon={Clock3} tone="neutral" />
      </section>
      )}
      <ServiceCatalog
        services={services}
        professionals={team.members}
        canManage={canManageServices(workspace.role)}
        currentMemberId={team.members.find((member) => member.userId === session.user.id)?.memberId ?? null}
        startCreating={novo === "1"}
        loadError={catalog.error}
        teamError={team.error}
        query={q ?? ""}
      />
    </>
  );
}
