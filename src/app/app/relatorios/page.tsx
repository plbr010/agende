import { ChartNoAxesCombined } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { requireActiveWorkspace, requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { AdvancedReportDashboard } from "@/components/reports/advanced-report-dashboard";
import { operationalModuleLoaders } from "@/lib/modules/operational-loaders.server";
import { resolvePeriod, todayInTimezone } from "@/lib/modules/periods";
import { PeriodSelector } from "@/components/modules/period-selector";
import { loadWorkspaceSettings } from "@/lib/workspace/queries";
import { InactiveSubscriptionNotice } from "@/components/workspace/inactive-subscription-notice";
import { isInactiveWorkspaceError } from "@/lib/workspace/settings-errors";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  const session = await requireConfirmedSession("/app/relatorios");
  const workspace = requireActiveWorkspace(session);
  const settings = await loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug);
  const period = resolvePeriod((await searchParams).period, todayInTimezone(settings.timezone));
  let report;
  try {
    report = await operationalModuleLoaders.reports({ workspaceId: workspace.id, from: period.startDate, to: period.endDate });
  } catch (error) {
    unstable_rethrow(error);
    if (!isInactiveWorkspaceError(error)) throw error;
    return (
      <>
        <PageHeader
          eyebrow="Decisões com contexto"
          title="Relatórios"
          description="Uma leitura clara do mês para reconhecer o que funciona e escolher o próximo passo do negócio."
          icon={ChartNoAxesCombined}
        />
        <InactiveSubscriptionNotice />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Decisões com contexto"
        title="Relatórios"
        description="Uma leitura clara do mês para reconhecer o que funciona e escolher o próximo passo do negócio."
        icon={ChartNoAxesCombined}
      />
      <PeriodSelector {...period} />
      <AdvancedReportDashboard report={report} />
    </>
  );
}
