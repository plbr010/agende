import { z } from "zod";

const financialEntryTypeSchema = z.enum(["income", "expense"]);
const paymentMethodSchema = z.enum(["cash", "pix", "debit_card", "credit_card", "bank_transfer", "other"]);

export const advancedReportRpcSchema = z.object({
  period: z.object({
    start_date: z.string().min(1),
    end_date: z.string().min(1),
    timezone: z.string().min(1),
  }),
  operations: z.object({
    appointments_total: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    no_show: z.number().int().nonnegative(),
    completion_rate_pct: z.number().nonnegative(),
    cancellation_rate_pct: z.number().nonnegative(),
    no_show_rate_pct: z.number().nonnegative(),
    average_service_ticket_cents: z.number().int().nonnegative(),
    completed_service_value_cents: z.number().int().nonnegative(),
  }),
  clients: z.object({
    unique_clients: z.number().int().nonnegative(),
    new_clients: z.number().int().nonnegative(),
    repeat_clients: z.number().int().nonnegative(),
  }),
  top_professionals: z.array(z.object({
    professional_member_id: z.string().uuid(),
    professional_name: z.string().min(1),
    completed_count: z.number().int().nonnegative(),
    service_value_cents: z.number().int().nonnegative(),
  })),
  finance_by_category: z.array(z.object({
    entry_type: financialEntryTypeSchema,
    category_name: z.string().min(1),
    paid_cents: z.number().int().nonnegative().nullable(),
    pending_cents: z.number().int().nonnegative().nullable(),
    refunded_cents: z.number().int().nonnegative(),
    net_cents: z.number().int(),
  })),
  payment_methods: z.array(z.object({
    payment_method: paymentMethodSchema,
    payments: z.number().int().nonnegative(),
    total_cents: z.number().int().nonnegative(),
  })),
  packages: z.object({
    sold: z.number().int().nonnegative(),
    redemptions: z.number().int().nonnegative(),
    reversed_redemptions: z.number().int().nonnegative(),
  }),
  inventory: z.object({
    active_products: z.number().int().nonnegative(),
    low_stock: z.number().int().nonnegative(),
    out_of_stock: z.number().int().nonnegative(),
    estimated_stock_cost_cents: z.number().int().nonnegative(),
  }),
});

export const advancedReportSchema = z.object({
  period: z.object({ startDate: z.string(), endDate: z.string(), timezone: z.string() }),
  operations: z.object({
    appointmentsTotal: z.number().int(),
    completed: z.number().int(),
    cancelled: z.number().int(),
    noShow: z.number().int(),
    completionRatePct: z.number(),
    cancellationRatePct: z.number(),
    noShowRatePct: z.number(),
    averageServiceTicketCents: z.number().int(),
    completedServiceValueCents: z.number().int(),
  }),
  clients: z.object({ uniqueClients: z.number().int(), newClients: z.number().int(), repeatClients: z.number().int() }),
  topProfessionals: z.array(z.object({
    professionalMemberId: z.string().uuid(),
    professionalName: z.string(),
    completedCount: z.number().int(),
    serviceValueCents: z.number().int(),
  })),
  financeByCategory: z.array(z.object({
    entryType: financialEntryTypeSchema,
    categoryName: z.string(),
    paidCents: z.number().int(),
    pendingCents: z.number().int(),
    refundedCents: z.number().int(),
    netCents: z.number().int(),
  })),
  paymentMethods: z.array(z.object({
    paymentMethod: paymentMethodSchema,
    payments: z.number().int(),
    totalCents: z.number().int(),
  })),
  packages: z.object({ sold: z.number().int(), redemptions: z.number().int(), reversedRedemptions: z.number().int() }),
  inventory: z.object({
    activeProducts: z.number().int(),
    lowStock: z.number().int(),
    outOfStock: z.number().int(),
    estimatedStockCostCents: z.number().int(),
  }),
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

export function adaptAdvancedReportPayload(raw: unknown): AdvancedReport {
  const payload = advancedReportRpcSchema.parse(raw);
  return advancedReportSchema.parse({
    period: {
      startDate: payload.period.start_date,
      endDate: payload.period.end_date,
      timezone: payload.period.timezone,
    },
    operations: {
      appointmentsTotal: payload.operations.appointments_total,
      completed: payload.operations.completed,
      cancelled: payload.operations.cancelled,
      noShow: payload.operations.no_show,
      completionRatePct: payload.operations.completion_rate_pct,
      cancellationRatePct: payload.operations.cancellation_rate_pct,
      noShowRatePct: payload.operations.no_show_rate_pct,
      averageServiceTicketCents: payload.operations.average_service_ticket_cents,
      completedServiceValueCents: payload.operations.completed_service_value_cents,
    },
    clients: {
      uniqueClients: payload.clients.unique_clients,
      newClients: payload.clients.new_clients,
      repeatClients: payload.clients.repeat_clients,
    },
    topProfessionals: payload.top_professionals.map((professional) => ({
      professionalMemberId: professional.professional_member_id,
      professionalName: professional.professional_name,
      completedCount: professional.completed_count,
      serviceValueCents: professional.service_value_cents,
    })),
    financeByCategory: payload.finance_by_category.map((category) => ({
      entryType: category.entry_type,
      categoryName: category.category_name,
      paidCents: category.paid_cents ?? 0,
      pendingCents: category.pending_cents ?? 0,
      refundedCents: category.refunded_cents,
      netCents: category.net_cents,
    })),
    paymentMethods: payload.payment_methods.map((payment) => ({
      paymentMethod: payment.payment_method,
      payments: payment.payments,
      totalCents: payment.total_cents,
    })),
    packages: {
      sold: payload.packages.sold,
      redemptions: payload.packages.redemptions,
      reversedRedemptions: payload.packages.reversed_redemptions,
    },
    inventory: {
      activeProducts: payload.inventory.active_products,
      lowStock: payload.inventory.low_stock,
      outOfStock: payload.inventory.out_of_stock,
      estimatedStockCostCents: payload.inventory.estimated_stock_cost_cents,
    },
  });
}

export function createReportsQueries(backend: ReportsBackend) {
  return {
    async load(input: AdvancedReportInput): Promise<AdvancedReport> {
      const safeInput = advancedReportInputSchema.parse(input);
      return adaptAdvancedReportPayload(await backend.loadAdvancedReport(safeInput));
    },
  };
}
