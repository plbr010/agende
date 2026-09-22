import assert from "node:assert/strict";
import test from "node:test";
import { createStripeBillingQueries } from "./stripe-contract";

test("stripe boundary validates checkout before calling a future adapter", async () => {
  let called = false;
  const billing = createStripeBillingQueries({
    async createCheckout() { called = true; return { url: "https://checkout.stripe.com/session" }; },
    async createPortal() { called = true; return { url: "https://billing.stripe.com/session" }; },
  });

  await assert.rejects(() => billing.checkout({
    workspaceId: "workspace-1",
    plan: "equipe",
    idempotencyKey: "short",
    successUrl: "https://agende.app/success",
    cancelUrl: "https://agende.app/cancel",
  }));
  assert.equal(called, false);
});

test("stripe boundary only returns validated https redirects", async () => {
  const billing = createStripeBillingQueries({
    async createCheckout() { return { url: "https://checkout.stripe.com/session" }; },
    async createPortal() { return { url: "javascript:alert(1)" }; },
  });
  const result = await billing.checkout({
    workspaceId: "workspace-1",
    plan: "solo",
    idempotencyKey: "billing-attempt-0001",
    successUrl: "https://agende.app/success",
    cancelUrl: "https://agende.app/cancel",
  });
  assert.match(result.url, /^https:\/\//);
  await assert.rejects(() => billing.portal({ workspaceId: "workspace-1", returnUrl: "https://agende.app/settings" }));
});
