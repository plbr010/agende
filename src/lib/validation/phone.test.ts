import assert from "node:assert/strict";
import test from "node:test";
import { formatPhoneBr, isValidPhone, normalizePhone } from "./phone";

test("normalizes Brazilian mobile to E.164", () => {
  assert.equal(normalizePhone("(32) 99999-9999"), "+5532999999999");
  assert.equal(normalizePhone("32999999999"), "+5532999999999");
  assert.equal(normalizePhone("+55 32 99999-9999"), "+5532999999999");
});

test("accepts numbers that already include country code", () => {
  assert.equal(normalizePhone("5532987654321"), "+5532987654321");
});

test("rejects empty phone", () => {
  assert.equal(normalizePhone(""), null);
  assert.equal(isValidPhone(""), false);
});

test("formats Brazilian phone for display", () => {
  assert.equal(formatPhoneBr("32999999999"), "(32) 99999-9999");
});
