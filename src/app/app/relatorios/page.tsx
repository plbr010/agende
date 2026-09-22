import { ChartNoAxesCombined } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { AdvancedReportDashboard } from "@/components/reports/advanced-report-dashboard";

export default async function ReportsPage() {
  await requireConfirmedSession("/app/relatorios");

  return (
    <>
      <PageHeader
        eyebrow="Decisões com contexto"
        title="Relatórios"
        description="Uma leitura clara do mês para reconhecer o que funciona e escolher o próximo passo do negócio."
        icon={ChartNoAxesCombined}
      />
      <AdvancedReportDashboard report={null} />
    </>
  );
}
