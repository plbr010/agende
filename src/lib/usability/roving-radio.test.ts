import assert from "node:assert/strict";
import test from "node:test";
import { nextEnabledRadioIndex, nextRadioIndex } from "./roving-radio";

test("arrow keys move around a radiogroup and ignore unrelated keys", () => {
  assert.equal(nextRadioIndex(0, 3, "ArrowRight"), 1);
  assert.equal(nextRadioIndex(2, 3, "ArrowRight"), 0);
  assert.equal(nextRadioIndex(0, 3, "ArrowLeft"), 2);
  assert.equal(nextRadioIndex(1, 3, "Home"), 0);
  assert.equal(nextRadioIndex(0, 3, "End"), 2);
  assert.equal(nextRadioIndex(0, 3, "Enter"), null);
});

test("disabled radios are skipped, including a locked client intent", () => {
  assert.equal(nextEnabledRadioIndex(1, [true, false], "ArrowUp"), 1);
  assert.equal(nextEnabledRadioIndex(1, [true, false], "Home"), 1);
  assert.equal(nextEnabledRadioIndex(0, [false, false], "ArrowDown"), 1);
});
