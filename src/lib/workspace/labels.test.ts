import assert from "node:assert/strict";
import test from "node:test";
import { formatWorkspaceSubscriptionStatus, LIFETIME_SUBSCRIPTION_LABEL, SUBSCRIPTION_STATUS_LABEL } from "./labels";

test("lifetime access is shown instead of the Stripe row status", () => {
  assert.equal(formatWorkspaceSubscriptionStatus("expired", true), LIFETIME_SUBSCRIPTION_LABEL);
  assert.equal(formatWorkspaceSubscriptionStatus("canceled", true), LIFETIME_SUBSCRIPTION_LABEL);
  assert.equal(formatWorkspaceSubscriptionStatus("expired"), SUBSCRIPTION_STATUS_LABEL.expired);
  assert.equal(formatWorkspaceSubscriptionStatus(null), SUBSCRIPTION_STATUS_LABEL.expired);
  assert.equal(formatWorkspaceSubscriptionStatus("active"), SUBSCRIPTION_STATUS_LABEL.active);
});
