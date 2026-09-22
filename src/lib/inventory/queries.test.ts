import assert from "node:assert/strict";
import test from "node:test";
import { createInventoryQueries, summarizeInventory } from "./queries";
import { inventoryUiRpcFixture } from "@/test-fixtures/operational-rpcs";

test("inventory query adapts the exact get_inventory_ui response", async () => {
  const queries = createInventoryQueries({
    async loadInventory(workspaceId) {
      assert.equal(workspaceId, "workspace-1");
      return inventoryUiRpcFixture;
    },
  });

  const snapshot = await queries.load("workspace-1");
  assert.equal(snapshot.products[0]?.name, "Coloração");
  assert.equal(snapshot.products[0]?.costCents, null);
  assert.equal(snapshot.recentMovements[0]?.quantityDelta, -1);
  assert.deepEqual(summarizeInventory(snapshot), {
    products: 1,
    lowStock: 1,
    outOfStock: 0,
    estimatedCostCents: 0,
  });
});

test("inventory query rejects incomplete remote payloads", async () => {
  const queries = createInventoryQueries({
    async loadInventory() {
      return { summary: {}, products: [{ id: "missing-fields" }], recent_movements: [] };
    },
  });

  await assert.rejects(() => queries.load("workspace-1"));
});
