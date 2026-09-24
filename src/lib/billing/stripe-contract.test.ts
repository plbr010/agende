import assert from "node:assert/strict";
import test from "node:test";
import { BILLING_INTERNAL_PATHS, createStripeBillingQueries } from "./stripe-contract";

test("stripe boundary validates checkout before calling a future adapter", async () => {
  let called = false;
  const billing = createStripeBillingQueries({
    async createCheckout() { called = true; return { url: "https://checkout.stripe.com/session" }; },
    async createPortal() { called = true; return { url: "https://billing.stripe.com/session" }; },
  });

  await assert.rejects(() => billing.checkout({
    workspaceId: "workspace-1",
    plan: "equipe",
    billingInterval: "monthly",
    idempotencyKey: "short",
  }));
  assert.equal(called, false);
});

test("stripe boundary only returns validated https redirects", async () => {
  let checkoutCommand: unknown;
  const billing = createStripeBillingQueries({
    async createCheckout(input) { checkoutCommand = input; return { url: "https://checkout.stripe.com/session" }; },
    async createPortal() { return { url: "https://attacker.example/session" }; },
  });
  const result = await billing.checkout({
    workspaceId: "workspace-1",
    plan: "solo",
    billingInterval: "annual",
    idempotencyKey: "billing-attempt-0001",
  });
  assert.match(result.url, /^https:\/\//);
  assert.deepEqual(checkoutCommand, {
    workspaceId: "workspace-1",
    plan: "solo",
    billingInterval: "annual",
    idempotencyKey: "billing-attempt-0001",
    successPath: BILLING_INTERNAL_PATHS.checkoutSuccess,
    cancelPath: BILLING_INTERNAL_PATHS.checkoutCancel,
  });
  await assert.rejects(() => billing.portal({ workspaceId: "workspace-1" }));
});
