import { createFinanceQueries, type FinanceBackend, type FinancialSnapshot } from "@/lib/finance/queries";
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
    async finance(workspaceId: string): Promise<FinancialSnapshot | null> {
      if (!adapters.finance) return null;
      return createFinanceQueries(adapters.finance).load(workspaceId);
    },
    async reports(input: AdvancedReportInput): Promise<AdvancedReport | null> {
      if (!adapters.reports) return null;
      return createReportsQueries(adapters.reports).load(input);
    },
  };
}

/**
 * Ponto único de composição. Os adaptadores Supabase reais entram aqui após
 * validar nomes de tabelas/RPCs, argumentos, RLS e formatos de retorno.
 */
export const operationalModuleLoaders = createOperationalModuleLoaders({});
