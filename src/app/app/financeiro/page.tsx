import { CircleDollarSign } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { requireActiveWorkspace, requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";
import { operationalModuleLoaders } from "@/lib/modules/operational-loaders.server";
import { resolvePeriod, todayInTimezone } from "@/lib/modules/periods";
import { PeriodSelector } from "@/components/modules/period-selector";
import { loadWorkspaceSettings } from "@/lib/workspace/queries";
import { InactiveSubscriptionNotice } from "@/components/workspace/inactive-subscription-notice";
import { isInactiveWorkspaceError } from "@/lib/workspace/settings-errors";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  const session = await requireConfirmedSession("/app/financeiro");
  const workspace = requireActiveWorkspace(session);
  const settings = await loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug);
  const period = resolvePeriod((await searchParams).period, todayInTimezone(settings.timezone));
  let snapshot;
  try {
    snapshot = await operationalModuleLoaders.finance({
      workspaceId: workspace.id,
      startDate: period.startDate,
      endDate: period.endDate,
    });
  } catch (error) {
    unstable_rethrow(error);
    if (!isInactiveWorkspaceError(error)) throw error;
    return (
      <>
        <PageHeader
          eyebrow="Dinheiro do salão"
          title="Financeiro"
          description="Anote o que entrou, o que saiu e o que ainda falta pagar."
          icon={CircleDollarSign}
        />
        <InactiveSubscriptionNotice />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Dinheiro do salão"
        title="Financeiro"
        description="Anote o que entrou, o que saiu e o que ainda falta pagar."
        icon={CircleDollarSign}
      />
      <PeriodSelector {...period} />
      <FinanceDashboard snapshot={snapshot}
        startDate={period.startDate}
        endDate={period.endDate}
        timeZone={settings.timezone}
        canManage={session.permissions ? Boolean(session.permissions["finance.manage"]) : ["owner", "admin"].includes(workspace.role)}
        canReceive={session.permissions ? Boolean(session.permissions["finance.receive"] || session.permissions["finance.manage"]) : ["owner", "admin", "receptionist"].includes(workspace.role)} />
    </>
  );
}
