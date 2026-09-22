import { createFinanceQueries, type FinanceBackend, type FinancePeriodInput, type FinancialSnapshot } from "@/lib/finance/queries";
import { createInventoryQueries, type InventoryBackend, type InventorySnapshot } from "@/lib/inventory/queries";
import { createPackagesQueries, type PackagesBackend, type PackagesSnapshot } from "@/lib/packages/queries";
import { createReportsQueries, type AdvancedReport, type AdvancedReportInput, type ReportsBackend } from "@/lib/reports/queries";

export type OperationalBackendAdapters = {
  inventory?: InventoryBackend;
  packages?: PackagesBackend;
  finance?: FinanceBackend;
  reports?: ReportsBackend;
};

export function createOperationalModuleLoaders(adapters: OperationalBackendAdapters) {
  return {
    async inventory(workspaceId: string): Promise<InventorySnapshot | null> {
      if (!adapters.inventory) return null;
      return createInventoryQueries(adapters.inventory).load(workspaceId);
    },
    async packages(workspaceId: string): Promise<PackagesSnapshot | null> {
      if (!adapters.packages) return null;
      return createPackagesQueries(adapters.packages).load(workspaceId);
    },
    async finance(input: FinancePeriodInput): Promise<FinancialSnapshot | null> {
      if (!adapters.finance) return null;
      return createFinanceQueries(adapters.finance).load(input);
    },
    async reports(input: AdvancedReportInput): Promise<AdvancedReport | null> {
      if (!adapters.reports) return null;
      return createReportsQueries(adapters.reports).load(input);
    },
  };
}
