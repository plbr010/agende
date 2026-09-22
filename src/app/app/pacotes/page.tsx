import { PackageCheck } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { PackagesDashboard } from "@/components/packages/packages-dashboard";
import { operationalModuleLoaders } from "@/lib/modules/operational-loaders";

export default async function PackagesPage() {
  const session = await requireConfirmedSession("/app/pacotes");
  const workspace = session.workspaces[0];
  if (!workspace) return null;
  const snapshot = await operationalModuleLoaders.packages(workspace.id);

  return (
    <>
      <PageHeader
        eyebrow="Fidelização"
        title="Pacotes"
        description="Crie combinações de serviços que valorizam seu trabalho e ajudam clientes a manter uma rotina de cuidado."
        icon={PackageCheck}
      />
      <PackagesDashboard snapshot={snapshot} />
    </>
  );
}
