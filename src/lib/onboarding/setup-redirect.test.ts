import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("createWorkspaceAction sends new salons into setup mode", () => {
  const source = readFileSync(new URL("../auth/actions.ts", import.meta.url), "utf8");
  const block = source.slice(
    source.indexOf("export async function createWorkspaceAction"),
    source.indexOf("export async function enableClientProfileAction"),
  );
  assert.match(block, /redirect\("\/app\?setup=1"\)/);
});

test("signup only persists plan when professional intent is selected", () => {
  const source = readFileSync(new URL("../../components/auth/signup-form.tsx", import.meta.url), "utf8");
  assert.match(source, /plan && intent === "professional"/);
  assert.match(source, /plano selecionado vale só para a conta profissional/i);
});

test("public booking clears stale slots before fetching", () => {
  const source = readFileSync(new URL("../../components/booking/public-booking-flow.tsx", import.meta.url), "utf8");
  assert.match(source, /slotsRequestId/);
  assert.match(source, /setSlots\(\[\]\)/);
  assert.match(source, /Trocar data/);
  assert.match(source, /Horários para/);
});
