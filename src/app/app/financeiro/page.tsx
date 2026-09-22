import { CircleDollarSign } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";
import { operationalModuleLoaders } from "@/lib/modules/operational-loaders";

export default async function FinancePage() {
  const session = await requireConfirmedSession("/app/financeiro");
  const workspace = session.workspaces[0];
  if (!workspace) return null;
  const snapshot = await operationalModuleLoaders.finance(workspace.id);

  return (
    <>
      <PageHeader
        eyebrow="Saúde do negócio"
        title="Financeiro"
        description="Comece pela receita real da agenda e evolua para um fluxo completo de entradas, saídas e conciliação."
        icon={CircleDollarSign}
      />
      <FinanceDashboard snapshot={snapshot} />
    </>
  );
}
