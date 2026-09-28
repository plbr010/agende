import { loadWorkspaceSettings } from "@/lib/workspace/queries";
import { loadServices, loadClients } from "@/lib/catalog/queries";
import { PackageCheck } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { PackagesDashboard } from "@/components/packages/packages-dashboard";
import { operationalModuleLoaders } from "@/lib/modules/operational-loaders.server";

export default async function PackagesPage() {
  const session = await requireConfirmedSession("/app/pacotes");
  const workspace = session.workspaces[0];
  if (!workspace) return null;
  const { timezone } = await loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug);
  const [snapshot, services, clients] = await Promise.all([operationalModuleLoaders.packages(workspace.id), loadServices(workspace.id), loadClients(workspace.id)]);

  return (
    <>
      <PageHeader
        eyebrow="Fidelização"
        title="Pacotes"
        description="Crie combinações de serviços que valorizam seu trabalho e ajudam clientes a manter uma rotina de cuidado."
        icon={PackageCheck}
      />
      <PackagesDashboard timezone={timezone} snapshot={snapshot} services={services} clients={clients} />
    </>
  );
}
