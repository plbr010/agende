import { z } from "zod";
import { adaptAdvancedReportPayload, advancedReportRpcSchema, advancedReportSchema } from "@/lib/reports/queries";

export const financialStatusSchema = z.enum(["pending", "paid", "cancelled"]);
export const financialKindSchema = z.enum(["income", "expense"]);
export const paymentMethodSchema = z.enum(["cash", "pix", "debit_card", "credit_card", "bank_transfer", "other"]);

const financialEntrySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  kind: financialKindSchema,
  status: financialStatusSchema,
  source: z.enum(["manual", "appointment", "package_sale"]),
  amountCents: z.number().int().nonnegative(),
  refundedCents: z.number().int().nonnegative(),
  categoryLabel: z.string().min(1),
  paymentMethodLabel: z.string().nullable(),
  clientName: z.string().nullable(),
  dueDate: z.string().nullable(),
  paidAt: z.string().nullable(),
  createdAt: z.string().min(1),
});

export const financeUiRpcSchema = z.object({
  report: advancedReportRpcSchema,
  entries: z.array(z.object({
    id: z.string().uuid(),
    entry_type: financialKindSchema,
    status: financialStatusSchema,
    source: z.enum(["manual", "appointment", "package_sale"]),
    description: z.string().min(1),
    amount_cents: z.number().int().nonnegative(),
    due_date: z.string().nullable(),
    paid_at: z.string().nullable(),
    payment_method: paymentMethodSchema.nullable(),
    created_at: z.string().min(1),
    category_name: z.string().nullable(),
    client_name: z.string().nullable(),
    refunded_cents: z.number().int().nonnegative(),
  })),
  categories: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    entry_type: financialKindSchema,
    system_key: z.string().nullable(),
    active: z.boolean(),
    archived_at: z.string().nullable(),
  })),
});

export const financialSnapshotSchema = z.object({
  summary: z.object({
    paidRevenueCents: z.number().int(),
    paidExpenseCents: z.number().int(),
    pendingCents: z.number().int(),
    refundedCents: z.number().int(),
    balanceCents: z.number().int(),
  }),
  report: advancedReportSchema,
  entries: z.array(financialEntrySchema),
  categories: z.array(z.object({
    id: z.string().uuid(),
    label: z.string().min(1),
    kind: financialKindSchema,
    systemKey: z.string().nullable(),
    active: z.boolean(),
    archivedAt: z.string().nullable(),
  })),
  paymentMethods: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })),
});

const idempotencyKeySchema = z.string().trim().min(8).max(120);
const optionalIdempotencyKeySchema = idempotencyKeySchema.nullable().optional();

export const financePeriodInputSchema = z.object({
  workspaceId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const createFinancialEntryInputSchema = z.object({
  workspaceId: z.string().min(1),
  idempotencyKey: optionalIdempotencyKeySchema,
  description: z.string().trim().min(1).max(160),
  kind: financialKindSchema,
  amountCents: z.number().int().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

export const markFinancialEntryPaidInputSchema = z.object({
  workspaceId: z.string().min(1),
  entryId: z.string().uuid(),
  paymentMethod: paymentMethodSchema,
  paidAt: z.string().min(1).optional(),
});

export const financialEntryActionInputSchema = z.object({
  workspaceId: z.string().min(1),
  entryId: z.string().uuid(),
});

export const refundFinancialEntryInputSchema = z.object({
  workspaceId: z.string().min(1),
  idempotencyKey: optionalIdempotencyKeySchema,
  entryId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
  paymentMethod: paymentMethodSchema,
  refundedAt: z.string().min(1).optional(),
});

export type FinancialSnapshot = z.infer<typeof financialSnapshotSchema>;
export type FinancePeriodInput = z.infer<typeof financePeriodInputSchema>;
export type CreateFinancialEntryInput = z.infer<typeof createFinancialEntryInputSchema>;
export type MarkFinancialEntryPaidInput = z.infer<typeof markFinancialEntryPaidInputSchema>;
export type FinancialEntryActionInput = z.infer<typeof financialEntryActionInputSchema>;
export type RefundFinancialEntryInput = z.infer<typeof refundFinancialEntryInputSchema>;

export interface FinanceBackend {
  loadFinance(input: FinancePeriodInput): Promise<unknown>;
  createEntry(input: CreateFinancialEntryInput): Promise<unknown>;
  markEntryPaid(input: MarkFinancialEntryPaidInput): Promise<unknown>;
  cancelEntry(input: FinancialEntryActionInput): Promise<unknown>;
  reopenEntry(input: FinancialEntryActionInput): Promise<unknown>;
  refundEntry(input: RefundFinancialEntryInput): Promise<unknown>;
}

const paymentMethodLabels: Record<z.infer<typeof paymentMethodSchema>, string> = {
  cash: "Dinheiro",
  pix: "Pix",
  debit_card: "Cartão de débito",
  credit_card: "Cartão de crédito",
  bank_transfer: "Transferência",
  other: "Outro",
};

export function adaptFinanceUiPayload(raw: unknown): FinancialSnapshot {
  const payload = financeUiRpcSchema.parse(raw);
  const report = adaptAdvancedReportPayload(payload.report);
  const paidRevenueCents = report.financeByCategory
    .filter((category) => category.entryType === "income")
    .reduce((total, category) => total + category.paidCents, 0);
  const paidExpenseCents = report.financeByCategory
    .filter((category) => category.entryType === "expense")
    .reduce((total, category) => total + category.paidCents, 0);
  const pendingCents = report.financeByCategory.reduce((total, category) => total + category.pendingCents, 0);
  const refundedCents = report.financeByCategory
    .filter((category) => category.entryType === "income")
    .reduce((total, category) => total + category.refundedCents, 0);
  const balanceCents = report.financeByCategory.reduce(
    (total, category) => total + (category.entryType === "income" ? category.netCents : -category.netCents),
    0,
  );

  return financialSnapshotSchema.parse({
    summary: { paidRevenueCents, paidExpenseCents, pendingCents, refundedCents, balanceCents },
    report,
    entries: payload.entries.map((entry) => ({
      id: entry.id,
      title: entry.description,
      kind: entry.entry_type,
      status: entry.status,
      source: entry.source,
      amountCents: entry.amount_cents,
      refundedCents: entry.refunded_cents,
      categoryLabel: entry.category_name ?? "Sem categoria",
      paymentMethodLabel: entry.payment_method ? paymentMethodLabels[entry.payment_method] : null,
      clientName: entry.client_name,
      dueDate: entry.due_date,
      paidAt: entry.paid_at,
      createdAt: entry.created_at,
    })),
    categories: payload.categories.map((category) => ({
      id: category.id,
      label: category.name,
      kind: category.entry_type,
      systemKey: category.system_key,
      active: category.active,
      archivedAt: category.archived_at,
    })),
    paymentMethods: report.paymentMethods.map((payment) => ({
      id: payment.paymentMethod,
      label: paymentMethodLabels[payment.paymentMethod],
    })),
  });
}

export function createFinanceQueries(backend: FinanceBackend) {
  return {
    async load(input: FinancePeriodInput): Promise<FinancialSnapshot> {
      const safeInput = financePeriodInputSchema.parse(input);
      return adaptFinanceUiPayload(await backend.loadFinance(safeInput));
    },
    async create(input: CreateFinancialEntryInput): Promise<string> {
      const safeInput = createFinancialEntryInputSchema.parse(input);
      return z.string().uuid().parse(await backend.createEntry(safeInput));
    },
    async markPaid(input: MarkFinancialEntryPaidInput): Promise<string> {
      const safeInput = markFinancialEntryPaidInputSchema.parse(input);
      return z.string().uuid().parse(await backend.markEntryPaid(safeInput));
    },
    async cancel(input: FinancialEntryActionInput): Promise<string> {
      const safeInput = financialEntryActionInputSchema.parse(input);
      return z.string().uuid().parse(await backend.cancelEntry(safeInput));
    },
    async reopen(input: FinancialEntryActionInput): Promise<string> {
      const safeInput = financialEntryActionInputSchema.parse(input);
      return z.string().uuid().parse(await backend.reopenEntry(safeInput));
    },
    async refund(input: RefundFinancialEntryInput): Promise<string> {
      const safeInput = refundFinancialEntryInputSchema.parse(input);
      return z.string().uuid().parse(await backend.refundEntry(safeInput));
    },
  };
}
