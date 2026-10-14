import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "public-booking-flow.tsx"), "utf8");

test("public booking reduces steps and keeps undo actions visible", () => {
  assert.match(source, /shouldSkipProfessionalStep/);
  assert.match(source, /proceedAfterSlot/);
  assert.match(source, /Reservar este horário/);
  assert.match(source, /Esse horário foi ocupado enquanto você entrava/);
  assert.match(source, /não atende mais este serviço/);
  assert.match(source, /você entra ou cria uma conta/);
  assert.match(source, /Duração/);
  assert.match(source, /Mudar horário/);
  assert.match(source, /Alterar meus dados/);
  assert.match(source, /bookingStepCaption/);
  assert.doesNotMatch(source, /no fuso do estabelecimento/);
  assert.doesNotMatch(source, /ative a área de cliente no painel/);
});

test("public booking locks navigation while a reservation is in flight", () => {
  assert.match(source, /reserving\.current/);
  assert.match(source, /if \(pending \|\| reserving\.current\) return/);
  assert.match(source, /disabled=\{pending\}/);
  assert.match(source, /aria-disabled=\{pending\}/);
});

test("returning to the slot step clears stale times before refetch", () => {
  assert.match(source, /if \(next === "slot"\)/);
  assert.match(source, /setSlots\(\[\]\)/);
  assert.match(source, /setSlotsLoading\(true\)/);
  assert.match(source, /disabled=\{pending \|\| slotsLoading\}/);
});
