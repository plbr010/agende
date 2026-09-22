import { z } from "zod";

export const financialStatusSchema = z.enum(["pending", "paid", "cancelled"]);
export const financialKindSchema = z.enum(["revenue", "expense"]);

const financialEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: financialKindSchema,
  status: financialStatusSchema,
  amountCents: z.number().int().nonnegative(),
  refundedCents: z.number().int().nonnegative(),
  categoryLabel: z.string().min(1),
  paymentMethodLabel: z.string().nullable(),
  occurredAt: z.string().min(1),
});

const refundSchema = z.object({
  id: z.string().min(1),
  entryId: z.string().min(1),
  amountCents: z.number().int().positive(),
  reason: z.string().nullable(),
  occurredAt: z.string().min(1),
});

export const financialSnapshotSchema = z.object({
  summary: z.object({
    paidRevenueCents: z.number().int(),
    paidExpenseCents: z.number().int(),
    pendingCents: z.number().int(),
    refundedCents: z.number().int(),
    balanceCents: z.number().int(),
  }),
  entries: z.array(financialEntrySchema),
  refunds: z.array(refundSchema),
  categories: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })),
  paymentMethods: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })),
});

const idempotencyKeySchema = z.string().trim().min(16).max(200);

export const createFinancialEntryInputSchema = z.object({
  workspaceId: z.string().min(1),
  idempotencyKey: idempotencyKeySchema,
  title: z.string().trim().min(1).max(160),
  kind: financialKindSchema,
  amountCents: z.number().int().positive(),
  categoryId: z.string().min(1),
  paymentMethodId: z.string().nullable(),
  status: financialStatusSchema,
});

export const refundFinancialEntryInputSchema = z.object({
  workspaceId: z.string().min(1),
  idempotencyKey: idempotencyKeySchema,
  entryId: z.string().min(1),
  amountCents: z.number().int().positive(),
  reason: z.string().trim().max(500).nullable(),
});

export type FinancialSnapshot = z.infer<typeof financialSnapshotSchema>;
export type CreateFinancialEntryInput = z.infer<typeof createFinancialEntryInputSchema>;
export type RefundFinancialEntryInput = z.infer<typeof refundFinancialEntryInputSchema>;

export interface FinanceBackend {
  loadFinance(workspaceId: string): Promise<unknown>;
  createEntry(input: CreateFinancialEntryInput): Promise<unknown>;
  refundEntry(input: RefundFinancialEntryInput): Promise<unknown>;
}

export function createFinanceQueries(backend: FinanceBackend) {
  return {
    async load(workspaceId: string): Promise<FinancialSnapshot> {
      return financialSnapshotSchema.parse(await backend.loadFinance(workspaceId));
    },
    async create(input: CreateFinancialEntryInput): Promise<FinancialSnapshot> {
      const safeInput = createFinancialEntryInputSchema.parse(input);
      return financialSnapshotSchema.parse(await backend.createEntry(safeInput));
    },
    async refund(input: RefundFinancialEntryInput): Promise<FinancialSnapshot> {
      const safeInput = refundFinancialEntryInputSchema.parse(input);
      return financialSnapshotSchema.parse(await backend.refundEntry(safeInput));
    },
  };
}
