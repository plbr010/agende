import assert from "node:assert/strict";
import test from "node:test";
import { createEdgeBillingBackend } from "./edge-adapter";
import { runBillingAction } from "./action-handler";
import { billingRedirectSchema } from "./stripe-contract";
import { checkoutDisabledReason, checkoutReturnMessage } from "./presentation";

test("all six checkout selections reach stripe-billing with authenticated workspace and no redirect input", async () => {
  for (const role of ["owner", "admin"]) for (const plan of ["solo", "equipe", "salao"]) for (const billingInterval of ["monthly", "annual"]) {
    const backend = createEdgeBillingBackend(async (name, { body }) => {
      assert.equal(name, "stripe-billing");
      assert.deepEqual(body, { action: "checkout", workspaceId: "trusted", plan, billingInterval, idempotencyKey: "same-attempt-123456" });
      return { data: { url: "https://checkout.stripe.com/c/pay/cs_test" }, error: null };
    });
    const result = await runBillingAction({ action: "checkout", workspaceId: "forged", plan, billingInterval,
      idempotencyKey: "same-attempt-123456", successPath: "https://evil.example" }, { id: "trusted", role }, backend);
    assert.ok(result.url);
  }
});

test("unauthorized roles, absent workspace and invalid selections never invoke Stripe", async () => {
  const backend = createEdgeBillingBackend(async () => { assert.fail("must not invoke"); });
  for (const role of ["professional", "receptionist", "removed"]) {
    assert.match((await runBillingAction({ action: "portal" }, { id: "id", role }, backend)).error!, /dono ou admin/);
  }
  assert.ok((await runBillingAction({ action: "portal" }, null, backend)).error);
  for (const input of [{ action: "checkout", plan: "free" }, { action: "delete" }, null,
    { action: "checkout", plan: "solo", billingInterval: "monthly", idempotencyKey: "x".repeat(101) }]) {
    assert.ok((await runBillingAction(input, { id: "id", role: "owner" }, backend)).error);
  }
});

test("portal adapter, Edge errors, malformed responses and network failures are safe", async () => {
  const workspace = { id: "id", role: "admin" };
  const good = createEdgeBillingBackend(async (name, options) => {
    assert.equal(name, "stripe-billing");
    assert.deepEqual(options.body, { action: "portal", workspaceId: "id" });
    return { data: { url: "https://billing.stripe.com/p/session/test" }, error: null };
  });
  assert.ok((await runBillingAction({ action: "portal" }, workspace, good)).url);
  const failed = createEdgeBillingBackend(async () => ({ data: null, error: { context: new Response(JSON.stringify({ error: "plan_seat_limit_exceeded" }), { status: 409 }) } }));
  assert.match((await runBillingAction({ action: "portal" }, workspace, failed)).error!, /profissionais/);
  for (const data of [null, {}, { url: "https://evil.example" }]) {
    assert.match((await runBillingAction({ action: "portal" }, workspace, createEdgeBillingBackend(async () => ({ data, error: null })))).error!, /Não foi possível/);
  }
  const network = createEdgeBillingBackend(async () => { throw new Error("sensitive backend diagnostic"); });
  assert.doesNotMatch((await runBillingAction({ action: "portal" }, workspace, network)).error!, /sensitive/);
});

test("redirect allowlist rejects credentials, lookalike hosts, ports and protocols", () => {
  for (const url of ["http://checkout.stripe.com/x", "https://checkout.stripe.com.evil.test/x", "https://evil.test@checkout.stripe.com/x", "https://billing.stripe.com:444/x", "javascript:alert(1)", "//checkout.stripe.com/x"]) {
    assert.equal(billingRedirectSchema.safeParse({ url }).success, false, url);
  }
});

test("checkout and portal redirects work without the optional URL.parse browser API", () => {
  const descriptor = Object.getOwnPropertyDescriptor(URL, "parse");
  Object.defineProperty(URL, "parse", { configurable: true, value: undefined });
  try {
    for (const url of ["https://checkout.stripe.com/c/pay/test", "https://billing.stripe.com/p/session/test"]) {
      assert.equal(billingRedirectSchema.safeParse({ url }).success, true);
    }
    assert.equal(billingRedirectSchema.safeParse({ url: "not a URL" }).success, false);
    assert.equal(billingRedirectSchema.safeParse({ url: "https://evil.example" }).success, false);
  } finally {
    if (descriptor) Object.defineProperty(URL, "parse", descriptor);
    else Reflect.deleteProperty(URL, "parse");
  }
});

test("seat limits fail closed and existing subscriptions use portal", () => {
  for (const [plan, limit] of [["solo", 1], ["equipe", 5], ["salao", 15]] as const) {
    assert.equal(checkoutDisabledReason(plan, limit, false, "trialing", true), null);
    assert.match(checkoutDisabledReason(plan, limit + 1, false, "trialing", true)!, /profissionais/);
    assert.ok(checkoutDisabledReason(plan, null, false, "trialing", true));
    assert.ok(checkoutDisabledReason(plan, 1, true, "past_due", true));
    assert.equal(checkoutDisabledReason(plan, 1, true, "canceled", true), null);
    assert.ok(checkoutDisabledReason(plan, 1, false, "trialing", false));
  }
  assert.match(checkoutReturnMessage("success")!, /confirmação.*instantes/);
  assert.match(checkoutReturnMessage("cancelled")!, /cancelado/);
  assert.equal(checkoutReturnMessage(["success"]), null);
});
