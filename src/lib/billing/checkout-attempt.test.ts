import assert from "node:assert/strict";
import test from "node:test";
import { nextCheckoutAttempt } from "./checkout-attempt";

test("checkout retries reuse a key; A to B to A starts a fresh attempt", () => {
  let sequence = 0;
  const key = () => String(++sequence);
  const a = nextCheckoutAttempt(null, "solo:monthly", key);
  assert.equal(nextCheckoutAttempt(a, "solo:monthly", key), a);
  const b = nextCheckoutAttempt(a, "equipe:monthly", key);
  const again = nextCheckoutAttempt(b, "solo:monthly", key);
  assert.notEqual(again.key, a.key);
  const annual = nextCheckoutAttempt(again, "solo:annual", key);
  assert.notEqual(annual.key, again.key);
});
