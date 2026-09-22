import assert from "node:assert/strict";
import test from "node:test";
import { createInventoryQueries, summarizeInventory } from "./queries";

test("inventory query validates the normalized backend contract", async () => {
  const queries = createInventoryQueries({
    async loadInventory(workspaceId) {
      assert.equal(workspaceId, "workspace-1");
      return {
        products: [
          {
            id: "product-1",
            name: "Coloração",
            quantity: 2,
            minimumQuantity: 3,
            costCents: 2500,
            updatedAt: "2026-09-22T10:00:00Z",
          },
        ],
        recentMovements: [
          {
            id: "movement-1",
            productId: "product-1",
            productName: "Coloração",
            quantityDelta: -1,
            label: "Consumo",
            occurredAt: "2026-09-22T09:00:00Z",
            note: null,
          },
        ],
      };
    },
  });

  const snapshot = await queries.load("workspace-1");
  assert.equal(snapshot.products[0]?.name, "Coloração");
  assert.deepEqual(summarizeInventory(snapshot), {
    products: 1,
    lowStock: 1,
    totalCostCents: 5000,
  });
});

test("inventory query rejects incomplete remote payloads", async () => {
  const queries = createInventoryQueries({
    async loadInventory() {
      return { products: [{ id: "missing-fields" }], recentMovements: [] };
    },
  });

  await assert.rejects(() => queries.load("workspace-1"));
});
