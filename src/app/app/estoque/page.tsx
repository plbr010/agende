import { Boxes } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { InventoryDashboard } from "@/components/inventory/inventory-dashboard";
import { operationalModuleLoaders } from "@/lib/modules/operational-loaders.server";

export default async function InventoryPage() {
  const session = await requireConfirmedSession("/app/estoque");
  const workspace = session.workspaces[0];
  if (!workspace) return null;
  const snapshot = await operationalModuleLoaders.inventory(workspace.id);

  return (
    <>
      <PageHeader
        eyebrow="Produtos e consumo"
        title="Estoque"
        description="Enxergue o que entra, o que sai e o que precisa de reposição antes de impactar seus atendimentos."
        icon={Boxes}
      />
      <InventoryDashboard snapshot={snapshot} />
    </>
  );
}
