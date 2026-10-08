import assert from "node:assert/strict";
import test from "node:test";
import { parsePlanId, planSignupHref } from "./plans";

test("parsePlanId accepts only Solo, Equipe and Salão", () => {
  assert.equal(parsePlanId("solo"), "solo");
  assert.equal(parsePlanId(" Equipe "), "equipe");
  assert.equal(parsePlanId("salao"), "salao");
  assert.equal(parsePlanId("enterprise"), null);
  assert.equal(parsePlanId(""), null);
});

test("planSignupHref carries the chosen plan into cadastro", () => {
  assert.equal(planSignupHref("solo"), "/cadastro?plan=solo");
  assert.equal(planSignupHref("equipe"), "/cadastro?plan=equipe");
  assert.equal(planSignupHref("salao"), "/cadastro?plan=salao");
});
