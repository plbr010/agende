import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPhoneBr,
  isValidPhone,
  normalizePhone,
} from "./phone";

test("normalizes Brazilian mobile with various DDD", () => {
  assert.equal(normalizePhone("(32) 99999-9999"), "+5532999999999");
  assert.equal(normalizePhone("32999999999"), "+5532999999999");
  assert.equal(normalizePhone("+55 32 99999-9999"), "+5532999999999");
  assert.equal(normalizePhone("5532999999999"), "+5532999999999");
  assert.equal(normalizePhone("(11) 98888-7777"), "+5511988887777");
});

test("keeps DDD 55 instead of treating it as country code", () => {
  assert.equal(normalizePhone("(55) 99999-9999"), "+5555999999999");
  assert.equal(normalizePhone("55999999999"), "+5555999999999");
  assert.equal(normalizePhone("+55 55 99999-9999"), "+5555999999999");
  assert.equal(normalizePhone("5555999999999"), "+5555999999999");
  assert.equal(formatPhoneBr("(55) 99999-9999"), "(55) 99999-9999");
  assert.equal(formatPhoneBr("55999999999"), "(55) 99999-9999");
  assert.equal(formatPhoneBr("+5555999999999"), "(55) 99999-9999");
});

test("normalizes landline 10-digit national numbers including DDD 55", () => {
  assert.equal(normalizePhone("(32) 3333-4444"), "+553233334444");
  assert.equal(normalizePhone("+55 11 3456-7890"), "+551134567890");
  assert.equal(normalizePhone("(55) 3333-4444"), "+555533334444");
  assert.equal(normalizePhone("5533334444"), "+555533334444");
});

test("rejects short, ambiguous, or non-BR numbers", () => {
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone("12345678"), null);
  assert.equal(normalizePhone("99999-9999"), null);
  assert.equal(normalizePhone("999999999"), null);
  assert.equal(normalizePhone("+1 202 555 0100"), null);
  assert.equal(normalizePhone("55"), null);
  assert.equal(normalizePhone("5555"), null);
  assert.equal(normalizePhone("(00) 99999-9999"), null);
  assert.equal(normalizePhone("02999999999"), null);
  assert.equal(isValidPhone("12345678"), false);
  assert.equal(isValidPhone(""), false);
  assert.equal(isValidPhone("(55) 99999-9999"), true);
});

test("formats Brazilian phone for display without stripping DDD 55", () => {
  assert.equal(formatPhoneBr("32999999999"), "(32) 99999-9999");
  assert.equal(formatPhoneBr("+5555999999999"), "(55) 99999-9999");
  assert.equal(formatPhoneBr("5533334444"), "(55) 3333-4444");
});
