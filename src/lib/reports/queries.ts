import { z } from "zod";

const reportValueSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.number().finite(),
  format: z.enum(["currency", "number", "percent"]),
  comparisonLabel: z.string().nullable(),
});

export const advancedReportSchema = z.object({
  period: z.object({ from: z.string().min(1), to: z.string().min(1), label: z.string().min(1) }),
  indicators: z.array(reportValueSchema),
  cashFlowSeries: z.array(z.object({ label: z.string().min(1), revenueCents: z.number().int(), expenseCents: z.number().int() })),
  rankings: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    items: z.array(z.object({ label: z.string().min(1), value: z.number().finite(), formattedValue: z.string().min(1) })),
  })),
  breakdowns: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    items: z.array(z.object({ label: z.string().min(1), amountCents: z.number().int(), sharePercent: z.number().min(0).max(100) })),
  })),
});

export const advancedReportInputSchema = z.object({
  workspaceId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type AdvancedReport = z.infer<typeof advancedReportSchema>;
export type AdvancedReportInput = z.infer<typeof advancedReportInputSchema>;

export interface ReportsBackend {
  loadAdvancedReport(input: AdvancedReportInput): Promise<unknown>;
}

export function createReportsQueries(backend: ReportsBackend) {
  return {
    async load(input: AdvancedReportInput): Promise<AdvancedReport> {
      const safeInput = advancedReportInputSchema.parse(input);
      return advancedReportSchema.parse(await backend.loadAdvancedReport(safeInput));
    },
  };
}
