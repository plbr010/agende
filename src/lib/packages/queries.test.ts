import assert from "node:assert/strict";
import test from "node:test";
import { createPackagesQueries, summarizePackages } from "./queries";

const payload = {
  catalog: [
    {
      id: "package-1",
      name: "Cuidado mensal",
      description: null,
      priceCents: 18000,
      validityDays: 60,
      active: true,
      sessions: [{ serviceId: "service-1", serviceName: "Escova", included: 4 }],
    },
  ],
  clientPackages: [
    {
      id: "sale-1",
      packageId: "package-1",
      packageName: "Cuidado mensal",
      clientId: "client-1",
      clientName: "Ana",
      purchasedAt: "2026-09-01T10:00:00Z",
      expiresAt: "2026-10-31T10:00:00Z",
      expired: false,
      reversedAt: null,
      stateLabel: "Ativo",
      usage: [{ serviceId: "service-1", serviceName: "Escova", included: 4, used: 1 }],
    },
  ],
};

test("packages query preserves catalog, validity and session usage", async () => {
  const queries = createPackagesQueries({
    async loadPackages() { return payload; },
    async sellPackage() { return payload; },
    async reversePackageSale() { return payload; },
  });

  const snapshot = await queries.load("workspace-1");
  assert.equal(snapshot.catalog[0]?.validityDays, 60);
  assert.deepEqual(summarizePackages(snapshot), {
    activeCatalogItems: 1,
    activeSales: 1,
    remainingSessions: 3,
  });
});

test("package mutations validate inputs before reaching the backend", async () => {
  let called = false;
  const queries = createPackagesQueries({
    async loadPackages() { return payload; },
    async sellPackage() { called = true; return payload; },
    async reversePackageSale() { called = true; return payload; },
  });

  await assert.rejects(() => queries.sell({ workspaceId: "", packageId: "package-1", clientId: "client-1" }));
  await assert.rejects(() => queries.reverse({ workspaceId: "workspace-1", clientPackageId: "sale-1", reason: "" }));
  assert.equal(called, false);
});
