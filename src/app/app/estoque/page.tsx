import { loadWorkspaceSettings } from "@/lib/workspace/queries";
import { Boxes } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { requireActiveWorkspace, requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { InventoryDashboard } from "@/components/inventory/inventory-dashboard";
import { operationalModuleLoaders } from "@/lib/modules/operational-loaders.server";
import { InactiveSubscriptionNotice } from "@/components/workspace/inactive-subscription-notice";
import { isInactiveWorkspaceError } from "@/lib/workspace/settings-errors";

export default async function InventoryPage() {
  const session = await requireConfirmedSession("/app/estoque");
  const workspace = requireActiveWorkspace(session);
  const { timezone } = await loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug);
  let snapshot;
  try {
    snapshot = await operationalModuleLoaders.inventory(workspace.id);
  } catch (error) {
    unstable_rethrow(error);
    if (!isInactiveWorkspaceError(error)) throw error;
    return (
      <>
        <PageHeader
          eyebrow="Produtos e consumo"
          title="Estoque"
          description="Enxergue o que entra, o que sai e o que precisa de reposição antes de impactar seus atendimentos."
          icon={Boxes}
        />
        <InactiveSubscriptionNotice />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Produtos e consumo"
        title="Estoque"
        description="Enxergue o que entra, o que sai e o que precisa de reposição antes de impactar seus atendimentos."
        icon={Boxes}
      />
      <InventoryDashboard timezone={timezone} snapshot={snapshot}
        canManage={Boolean(session.permissions?.["inventory.manage"])}
        canMove={Boolean(session.permissions?.["inventory.move"] || session.permissions?.["inventory.manage"])} />
    </>
  );
}
