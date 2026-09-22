import assert from "node:assert/strict";
import test from "node:test";
import { createOperationalModuleLoaders } from "./operational-loaders";

test("operational loaders expose an honest unavailable state without adapters", async () => {
  const loaders = createOperationalModuleLoaders({});
  assert.equal(await loaders.inventory("workspace-1"), null);
  assert.equal(await loaders.packages("workspace-1"), null);
  assert.equal(await loaders.finance("workspace-1"), null);
  assert.equal(
    await loaders.reports({ workspaceId: "workspace-1", from: "2026-09-01", to: "2026-09-30" }),
    null,
  );
});

test("operational loaders delegate to a configured normalized adapter", async () => {
  const loaders = createOperationalModuleLoaders({
    inventory: {
      async loadInventory(workspaceId) {
        assert.equal(workspaceId, "workspace-1");
        return { products: [], recentMovements: [] };
      },
    },
  });
  assert.deepEqual(await loaders.inventory("workspace-1"), { products: [], recentMovements: [] });
});
