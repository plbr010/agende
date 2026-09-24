import { ChartNoAxesCombined } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { AdvancedReportDashboard } from "@/components/reports/advanced-report-dashboard";
import { operationalModuleLoaders } from "@/lib/modules/operational-loaders.server";
import { todayInProductTz } from "@/lib/time/timezone";

export default async function ReportsPage() {
  const session = await requireConfirmedSession("/app/relatorios");
  const workspace = session.workspaces[0];
  if (!workspace) return null;
  const today = todayInProductTz();
  const report = await operationalModuleLoaders.reports({ workspaceId: workspace.id, from: `${today.slice(0, 7)}-01`, to: today });

  return (
    <>
      <PageHeader
        eyebrow="Decisões com contexto"
        title="Relatórios"
        description="Uma leitura clara do mês para reconhecer o que funciona e escolher o próximo passo do negócio."
        icon={ChartNoAxesCombined}
      />
      <AdvancedReportDashboard report={report} />
    </>
  );
}
