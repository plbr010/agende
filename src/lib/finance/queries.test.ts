import assert from "node:assert/strict";
import test from "node:test";
import { createFinanceQueries } from "./queries";
import { financeUiRpcFixture } from "@/test-fixtures/operational-rpcs";

const entryId = "88888888-8888-4888-8888-888888888888";

test("finance query adapts the exact get_finance_ui response for a required period", async () => {
  const queries = createFinanceQueries({
    async loadFinance(input) {
      assert.deepEqual(input, { workspaceId: "workspace-1", startDate: "2026-09-01", endDate: "2026-09-30" });
      return financeUiRpcFixture;
    },
    async createEntry() { return entryId; },
    async markEntryPaid() { return entryId; },
    async cancelEntry() { return entryId; },
    async reopenEntry() { return entryId; },
    async refundEntry() { return entryId; },
  });
  const result = await queries.load({ workspaceId: "workspace-1", startDate: "2026-09-01", endDate: "2026-09-30" });
  assert.equal(result.entries[0]?.status, "paid");
  assert.equal(result.entries[0]?.kind, "income");
  assert.equal(result.summary.balanceCents, 23000);
  assert.equal(result.summary.refundedCents, 2000);
});

test("financial writes validate the real create and refund contracts", async () => {
  let called = false;
  const queries = createFinanceQueries({
    async loadFinance() { return financeUiRpcFixture; },
    async createEntry() { called = true; return entryId; },
    async markEntryPaid() { called = true; return entryId; },
    async cancelEntry() { called = true; return entryId; },
    async reopenEntry() { called = true; return entryId; },
    async refundEntry() { called = true; return entryId; },
  });
  await assert.rejects(() => queries.create({ workspaceId: "workspace-1", idempotencyKey: "short", description: "Receita", kind: "income", amountCents: 1000 }));
  await assert.rejects(() => queries.refund({ workspaceId: "workspace-1", entryId, amountCents: 100, reason: "", paymentMethod: "pix" }));
  assert.equal(called, false);
});

test("payment, cancellation, reopening and refund are distinct finance actions", async () => {
  const calls: string[] = [];
  const queries = createFinanceQueries({
    async loadFinance() { return financeUiRpcFixture; },
    async createEntry(input) { calls.push(`create:${input.kind}`); return entryId; },
    async markEntryPaid(input) { calls.push(`pay:${input.paymentMethod}`); return entryId; },
    async cancelEntry() { calls.push("cancel"); return entryId; },
    async reopenEntry() { calls.push("reopen"); return entryId; },
    async refundEntry(input) { calls.push(`refund:${input.paymentMethod}:${input.reason}`); return entryId; },
  });

  await queries.create({ workspaceId: "workspace-1", description: "Receita", kind: "income", amountCents: 1000 });
  await queries.markPaid({ workspaceId: "workspace-1", entryId, paymentMethod: "pix" });
  await queries.cancel({ workspaceId: "workspace-1", entryId });
  await queries.reopen({ workspaceId: "workspace-1", entryId });
  await queries.refund({ workspaceId: "workspace-1", entryId, amountCents: 100, reason: "Cobrança duplicada", paymentMethod: "pix" });

  assert.deepEqual(calls, ["create:income", "pay:pix", "cancel", "reopen", "refund:pix:Cobrança duplicada"]);
});
