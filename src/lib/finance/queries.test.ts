import assert from "node:assert/strict";
import test from "node:test";
import { createFinanceQueries } from "./queries";

const snapshot = {
  summary: { paidRevenueCents: 30000, paidExpenseCents: 5000, pendingCents: 10000, refundedCents: 2000, balanceCents: 23000 },
  entries: [{ id: "entry-1", title: "Atendimento", kind: "revenue", status: "paid", amountCents: 30000, refundedCents: 2000, categoryLabel: "Serviços", paymentMethodLabel: "Pix", occurredAt: "2026-09-22T10:00:00Z" }],
  refunds: [{ id: "refund-1", entryId: "entry-1", amountCents: 2000, reason: null, occurredAt: "2026-09-22T11:00:00Z" }],
  categories: [{ id: "category-1", label: "Serviços" }],
  paymentMethods: [{ id: "payment-1", label: "Pix" }],
};

test("finance query accepts real entries, refunds and backend totals", async () => {
  const queries = createFinanceQueries({
    async loadFinance() { return snapshot; },
    async createEntry() { return snapshot; },
    async refundEntry() { return snapshot; },
  });
  const result = await queries.load("workspace-1");
  assert.equal(result.entries[0]?.status, "paid");
  assert.equal(result.summary.balanceCents, 23000);
  assert.equal(result.refunds[0]?.amountCents, 2000);
});

test("financial writes require an idempotency key", async () => {
  let called = false;
  const queries = createFinanceQueries({
    async loadFinance() { return snapshot; },
    async createEntry() { called = true; return snapshot; },
    async refundEntry() { called = true; return snapshot; },
  });
  await assert.rejects(() => queries.create({ workspaceId: "workspace-1", idempotencyKey: "short", title: "Receita", kind: "revenue", amountCents: 1000, categoryId: "category-1", paymentMethodId: null, status: "pending" }));
  await assert.rejects(() => queries.refund({ workspaceId: "workspace-1", idempotencyKey: "", entryId: "entry-1", amountCents: 100, reason: null }));
  assert.equal(called, false);
});
