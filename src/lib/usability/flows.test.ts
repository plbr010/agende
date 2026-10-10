import assert from "node:assert/strict";
import test from "node:test";
import { USABILITY_FLOWS, usabilityStepCount } from "./flows";

test("reference tasks stay short enough for unaided first use", () => {
  assert.ok(usabilityStepCount("client-book") <= 7);
  assert.ok(usabilityStepCount("pro-service") <= 5);
  assert.ok(usabilityStepCount("pro-next") <= 2);
  assert.ok(usabilityStepCount("finance-entry") <= 4);
});

test("every recorded flow names a goal and a difficulty note", () => {
  assert.ok(USABILITY_FLOWS.length >= 6);
  for (const flow of USABILITY_FLOWS) {
    assert.ok(flow.goal.length > 10);
    assert.ok(flow.steps.length >= 2);
    assert.ok(flow.difficultyNotes.length >= 1);
  }
});
