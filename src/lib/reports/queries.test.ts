import assert from "node:assert/strict";
import test from "node:test";
import { createReportsQueries } from "./queries";
import { advancedReportRpcFixture } from "@/test-fixtures/operational-rpcs";

test("advanced reports adapt the exact get_workspace_advanced_report response", async () => {
  const queries = createReportsQueries({
    async loadAdvancedReport(input) {
      assert.equal(input.from, "2026-09-01");
      return advancedReportRpcFixture;
    },
  });
  const report = await queries.load({ workspaceId: "workspace-1", from: "2026-09-01", to: "2026-09-30" });
  assert.equal(report.operations.completed, 9);
  assert.equal(report.topProfessionals[0]?.professionalName, "Carla");
  assert.equal(report.financeByCategory[1]?.pendingCents, 0);
  assert.equal("cashFlowSeries" in report, false);
});

test("advanced report rejects invalid periods before the adapter", async () => {
  let called = false;
  const queries = createReportsQueries({ async loadAdvancedReport() { called = true; return {}; } });
  await assert.rejects(() => queries.load({ workspaceId: "workspace-1", from: "01/09/2026", to: "2026-09-30" }));
  assert.equal(called, false);
});
