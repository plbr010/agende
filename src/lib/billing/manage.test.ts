import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createEdgeManageBackend } from "./edge-adapter";
import { loadSubscriptionState, runManageAction, type SubscriptionState } from "./manage";
import { SubscriptionManager } from "../../components/billing/subscription-manager";

const monthly: SubscriptionState = {
  status: "active", plan: "equipe", interval: "monthly", trialEnd: null,
  currentPeriodEnd: "2026-12-09T15:00:00.000Z", cancelScheduled: false, cancelAt: null,
  canSwitchToAnnual: true, canCancel: true, canResume: false,
};

test("manage actions reach stripe-billing with the trusted workspace only", async () => {
  const bodies: object[] = [];
  const backend = createEdgeManageBackend(async (name, { body }) => {
    assert.equal(name, "stripe-billing");
    bodies.push(body);
    const action = (body as { action: string }).action;
    return action === "preview_annual"
      ? { data: { preview: { plan: "equipe", amountDueCents: 72384, annualAmountCents: 79900, yearChargeCents: 77711, creditCents: 5327, chargesAt: null, renewsAt: "2029-11-17T10:22:07.000Z" } }, error: null }
      : { data: { subscription: { ...monthly, cancelScheduled: action === "cancel", canResume: action === "cancel" } }, error: null };
  });
  const workspace = { id: "trusted", role: "owner" };
  const preview = await runManageAction({ action: "preview_annual", workspaceId: "forged" }, workspace, backend);
  assert.deepEqual(preview, { ok: true, preview: { plan: "equipe", amountDueCents: 72384, annualAmountCents: 79900, yearChargeCents: 77711, creditCents: 5327, chargesAt: null, renewsAt: "2029-11-17T10:22:07.000Z" } });
  assert.equal((await runManageAction({ action: "switch_annual", idempotencyKey: "0f8c7d5e-1111-2222-3333-444455556666" }, workspace, backend)).ok, true);
  const canceled = await runManageAction({ action: "cancel" }, { id: "trusted", role: "admin" }, backend);
  assert.ok(canceled.ok && canceled.subscription?.cancelScheduled);
  assert.equal((await runManageAction({ action: "resume" }, workspace, backend)).ok, true);
  assert.deepEqual(bodies, [
    { action: "preview_annual", workspaceId: "trusted" },
    { action: "switch_annual", idempotencyKey: "0f8c7d5e-1111-2222-3333-444455556666", workspaceId: "trusted" },
    { action: "cancel", workspaceId: "trusted" },
    { action: "resume", workspaceId: "trusted" },
  ]);
});

test("professionals, missing workspace and invalid input never reach Stripe", async () => {
  let calls = 0;
  const backend = async () => { calls += 1; return {}; };
  assert.equal((await runManageAction({ action: "cancel" }, { id: "w", role: "professional" }, backend)).ok, false);
  assert.equal((await runManageAction({ action: "cancel" }, null, backend)).ok, false);
  assert.equal((await runManageAction({ action: "switch_annual" }, { id: "w", role: "owner" }, backend)).ok, false);
  assert.equal((await runManageAction({ action: "switch_annual", idempotencyKey: "bad key with spaces!" }, { id: "w", role: "owner" }, backend)).ok, false);
  assert.equal((await runManageAction({ action: "downgrade" }, { id: "w", role: "owner" }, backend)).ok, false);
  assert.equal(calls, 0);
});

test("a declined card on the annual switch explains that nothing changed", async () => {
  const backend = createEdgeManageBackend(async () => ({
    data: null, error: { context: new Response(JSON.stringify({ error: "payment_declined" }), { status: 409 }) },
  }));
  const result = await runManageAction({ action: "switch_annual", idempotencyKey: "0f8c7d5e-1111-2222-3333-444455556666" }, { id: "w", role: "owner" }, backend);
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : "", /Nada foi alterado: sua assinatura continua mensal/);
});

test("subscription state loads from Stripe and degrades to null", async () => {
  assert.deepEqual(await loadSubscriptionState("w", async () => ({ subscription: monthly })), monthly);
  assert.equal(await loadSubscriptionState("w", async () => ({ subscription: null })), null);
  assert.equal(await loadSubscriptionState("w", async () => { throw new Error("billing_unavailable"); }), null);
  assert.equal(await loadSubscriptionState("w", async () => ({ subscription: { status: "active" } })), null);
});

test("manager shows switch and cancel for a monthly plan, and undo when cancellation is scheduled", () => {
  const action = async () => ({ ok: false as const, error: "x" });
  const html = renderToStaticMarkup(createElement(SubscriptionManager, { state: monthly, timezone: "America/Sao_Paulo", canManage: true, action }));
  assert.ok(html.includes("Mudar para o plano anual"));
  assert.ok(html.includes("R$ 799/ano"));
  assert.ok(html.includes("Cancelar assinatura"));
  assert.ok(html.includes("próxima cobrança em"));

  const scheduled = renderToStaticMarkup(createElement(SubscriptionManager, {
    state: { ...monthly, cancelScheduled: true, cancelAt: "2026-12-09T15:00:00.000Z", canSwitchToAnnual: false, canCancel: false, canResume: true },
    timezone: "America/Sao_Paulo", canManage: true, action,
  }));
  assert.ok(scheduled.includes("Cancelamento agendado"));
  assert.ok(scheduled.includes("Manter minha assinatura"));
  assert.ok(!scheduled.includes("Mudar para o plano anual"));

  const annual = renderToStaticMarkup(createElement(SubscriptionManager, {
    state: { ...monthly, interval: "annual", canSwitchToAnnual: false }, timezone: "America/Sao_Paulo", canManage: true, action,
  }));
  assert.ok(!annual.includes("Mudar para o plano anual"));
  assert.ok(annual.includes("anual"));
  assert.equal(renderToStaticMarkup(createElement(SubscriptionManager, { state: monthly, timezone: "America/Sao_Paulo", canManage: false, action })), "");
});
