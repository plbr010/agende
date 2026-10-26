import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { sanitizeBookingError } from "./validation";

test("workspace_unavailable maps to a temporary agenda message", () => {
  assert.match(sanitizeBookingError("workspace_unavailable"), /temporariamente indisponível/i);
});

test("booking_creation_paused maps to a closed agenda message", () => {
  assert.match(sanitizeBookingError("booking_creation_paused"), /não está aberta para novos agendamentos/i);
});

test("agendar page distinguishes unavailable from not found", () => {
  const page = readFileSync(new URL("../../app/p/[slug]/agendar/page.tsx", import.meta.url), "utf8");
  assert.match(page, /BookingUnavailableNotice/);
  assert.match(page, /loadPublicBookingCatalogResult/);
  assert.match(page, /unavailable/);
});
