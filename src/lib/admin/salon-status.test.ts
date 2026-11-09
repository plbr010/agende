import assert from "node:assert/strict";
import test from "node:test";
import { salonStatus, trialDays, SALON_FILTERS, SALON_STATUS } from "./salon-status";
test("trial uses explicit server snapshot time, never negative days or paid trials", () => {
  assert.equal(trialDays("trial", "2026-11-06T12:00:00Z", "2026-11-05T13:00:00Z"), 1);
  assert.equal(trialDays("paid", "2026-11-06T12:00:00Z", "2026-11-05T13:00:00Z"), null);
  assert.equal(trialDays("trial", "2026-11-04T12:00:00Z", "2026-11-05T13:00:00Z"), null);
  assert.equal(trialDays("trial", "invalid", "invalid"), null);
});
test("all required statuses remain distinct; unknown state never becomes debt", () => {
  for (const status of Object.keys(SALON_STATUS)) assert.equal(salonStatus(status), status);
  for (const value of [null, undefined, "stripe_unavailable", "constructor", "toString", {}]) assert.equal(salonStatus(value), "unverified");
  assert.notEqual(SALON_STATUS.past_due, SALON_STATUS.unpaid);
  assert.notEqual(SALON_STATUS.trial, SALON_STATUS.paid);
  assert(SALON_FILTERS.some((f) => f.value === "none"));
});
