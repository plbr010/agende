import assert from "node:assert/strict";
import test from "node:test";
import { createReportsQueries } from "./queries";

test("advanced reports preserve backend indicators and analytical series", async () => {
  const queries = createReportsQueries({
    async loadAdvancedReport(input) {
      assert.equal(input.from, "2026-09-01");
      return {
        period: { from: input.from, to: input.to, label: "Setembro" },
        indicators: [{ id: "net", label: "Resultado", value: 420000, format: "currency", comparisonLabel: "+12%" }],
        cashFlowSeries: [{ label: "Semana 1", revenueCents: 500000, expenseCents: 80000 }],
        rankings: [{ id: "services", title: "Serviços", items: [{ label: "Corte", value: 12, formattedValue: "12 atendimentos" }] }],
        breakdowns: [{ id: "payments", title: "Pagamentos", items: [{ label: "Pix", amountCents: 420000, sharePercent: 84 }] }],
      };
    },
  });
  const report = await queries.load({ workspaceId: "workspace-1", from: "2026-09-01", to: "2026-09-30" });
  assert.equal(report.indicators[0]?.value, 420000);
  assert.equal(report.rankings[0]?.items[0]?.label, "Corte");
});

test("advanced report rejects invalid periods before the adapter", async () => {
  let called = false;
  const queries = createReportsQueries({ async loadAdvancedReport() { called = true; return {}; } });
  await assert.rejects(() => queries.load({ workspaceId: "workspace-1", from: "01/09/2026", to: "2026-09-30" }));
  assert.equal(called, false);
});
