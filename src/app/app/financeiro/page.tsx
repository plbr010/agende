import { CircleDollarSign } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";
import { operationalModuleLoaders } from "@/lib/modules/operational-loaders.server";
import { resolvePeriod, todayInTimezone } from "@/lib/modules/periods";
import { PeriodSelector } from "@/components/modules/period-selector";
import { loadWorkspaceSettings } from "@/lib/workspace/queries";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  const session = await requireConfirmedSession("/app/financeiro");
  const workspace = session.workspaces[0];
  if (!workspace) return null;
  const settings = await loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug);
  const period = resolvePeriod((await searchParams).period, todayInTimezone(settings.timezone));
  const snapshot = await operationalModuleLoaders.finance({
    workspaceId: workspace.id,
    startDate: period.startDate,
    endDate: period.endDate,
  });

  return (
    <>
      <PageHeader
        eyebrow="Saúde do negócio"
        title="Financeiro"
        description="Acompanhe receitas, despesas e pagamentos do seu negócio."
        icon={CircleDollarSign}
      />
      <PeriodSelector {...period} />
      <FinanceDashboard snapshot={snapshot} />
    </>
  );
}
