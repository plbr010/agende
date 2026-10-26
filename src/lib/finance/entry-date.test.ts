import assert from "node:assert/strict";
import test from "node:test";
import { entryDateLabel } from "./entry-date.ts";

const zone = "America/Sao_Paulo";

test("shows the due date when the entry already has one", () => {
  assert.equal(entryDateLabel("2026-10-26", "2026-10-27T03:00:00.000Z", zone), "26/10/2026");
});

test("shows the payment date in the salon timezone when the due date is missing", () => {
  assert.equal(entryDateLabel(null, "2026-10-26T02:30:00.000Z", zone), "25/10/2026");
  assert.equal(entryDateLabel(null, "2026-10-26T03:00:00.000Z", zone), "26/10/2026");
});

test("says the date is unknown only when neither date exists", () => {
  assert.equal(entryDateLabel(null, null, zone), "Não informado");
  assert.equal(entryDateLabel(null, "not-a-date", zone), "Não informado");
});
