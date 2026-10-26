import { loadWorkspaceSettings } from "@/lib/workspace/queries";
import { loadServices, loadClients } from "@/lib/catalog/queries";
import { PackageCheck } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { requireActiveWorkspace, requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { PackagesDashboard } from "@/components/packages/packages-dashboard";
import { operationalModuleLoaders } from "@/lib/modules/operational-loaders.server";
import { InactiveSubscriptionNotice } from "@/components/workspace/inactive-subscription-notice";
import { isInactiveWorkspaceError } from "@/lib/workspace/settings-errors";

export default async function PackagesPage() {
  const session = await requireConfirmedSession("/app/pacotes");
  const workspace = requireActiveWorkspace(session);
  const { timezone } = await loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug);
  let snapshot;
  let services;
  let clients;
  try {
    [snapshot, services, clients] = await Promise.all([operationalModuleLoaders.packages(workspace.id), loadServices(workspace.id), loadClients(workspace.id)]);
  } catch (error) {
    unstable_rethrow(error);
    if (!isInactiveWorkspaceError(error)) throw error;
    return (
      <>
        <PageHeader
          eyebrow="Fidelização"
          title="Pacotes"
          description="Crie combinações de serviços que valorizam seu trabalho e ajudam clientes a manter uma rotina de cuidado."
          icon={PackageCheck}
        />
        <InactiveSubscriptionNotice />
      </>
    );
  }

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
