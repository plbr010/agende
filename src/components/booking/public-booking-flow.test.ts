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
  assert.match(source, /Mudar horário/);
  assert.match(source, /Alterar meus dados/);
  assert.match(source, /bookingStepCaption/);
  assert.doesNotMatch(source, /no fuso do estabelecimento/);
  assert.doesNotMatch(source, /ative a área de cliente no painel/);
});
