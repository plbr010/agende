import assert from "node:assert/strict";
import test from "node:test";
import { createPackagesQueries, summarizePackages } from "./queries";
import { packagesUiRpcFixture } from "@/test-fixtures/operational-rpcs";

const saleId = "55555555-5555-4555-8555-555555555555";
const redemptionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("packages query adapts catalog and sales from the exact get_packages_ui response", async () => {
  const queries = createPackagesQueries({
    async loadPackages() { return packagesUiRpcFixture; },
    async sellPackage() { return saleId; },
    async cancelClientPackage() { return saleId; },
    async reversePackageRedemption() {
      return {
        redemption_id: redemptionId,
        client_package_id: saleId,
        appointment_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        package_status: "active",
        remaining_after_reversal: 4,
      };
    },
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
    async loadPackages() { return packagesUiRpcFixture; },
    async sellPackage() { called = true; return saleId; },
    async cancelClientPackage() { called = true; return saleId; },
    async reversePackageRedemption() { called = true; return {}; },
  });

  await assert.rejects(() => queries.sell({ workspaceId: "", packageId: "package-1", clientId: "client-1" }));
  await assert.rejects(() => queries.cancel({ workspaceId: "", clientPackageId: saleId }));
  await assert.rejects(() => queries.reverseRedemption({ workspaceId: "workspace-1", redemptionId, reason: "" }));
  assert.equal(called, false);
});

test("package cancellation and redemption reversal call distinct contracts", async () => {
  const calls: string[] = [];
  const queries = createPackagesQueries({
    async loadPackages() { return packagesUiRpcFixture; },
    async sellPackage() { return saleId; },
    async cancelClientPackage() { calls.push("cancel"); return saleId; },
    async reversePackageRedemption(input) {
      calls.push(`reverse:${input.redemptionId}`);
      return {
        redemption_id: input.redemptionId,
        client_package_id: saleId,
        appointment_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        package_status: "active",
        remaining_after_reversal: 4,
      };
    },
  });

  await queries.cancel({ workspaceId: "workspace-1", clientPackageId: saleId });
  await queries.reverseRedemption({ workspaceId: "workspace-1", redemptionId, reason: "Erro operacional" });
  assert.deepEqual(calls, ["cancel", `reverse:${redemptionId}`]);
});
