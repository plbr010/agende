import { ChartNoAxesCombined } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { AdvancedReportDashboard } from "@/components/reports/advanced-report-dashboard";
import { operationalModuleLoaders } from "@/lib/modules/operational-loaders.server";
import { resolvePeriod, todayInTimezone } from "@/lib/modules/periods";
import { PeriodSelector } from "@/components/modules/period-selector";
import { loadWorkspaceSettings } from "@/lib/workspace/queries";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  const session = await requireConfirmedSession("/app/relatorios");
  const workspace = session.workspaces[0];
  if (!workspace) return null;
  const settings = await loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug);
  const period = resolvePeriod((await searchParams).period, todayInTimezone(settings.timezone));
  const report = await operationalModuleLoaders.reports({ workspaceId: workspace.id, from: period.startDate, to: period.endDate });

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
