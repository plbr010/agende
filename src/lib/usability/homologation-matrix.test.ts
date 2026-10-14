import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { HOMOLOGATION_JOURNEYS, homologationCounts } from "./homologation-matrix";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

test("homologation board never marks a missing backend as PASS", () => {
  const counts = homologationCounts();
  assert.equal(counts.fail, 0);
  assert.ok(counts.pass >= 6);
  assert.ok(counts.blocked >= 2);
  const rpc = HOMOLOGATION_JOURNEYS.find((row) => row.id === "client-search-rpc");
  assert.equal(rpc?.status, "BLOQUEADO");
  assert.equal(rpc?.owner, "Codex");
  const prodBook = HOMOLOGATION_JOURNEYS.find((row) => row.id === "client-booking-production");
  assert.equal(prodBook?.status, "BLOQUEADO");
});

test("isolated browser e2e uses roles and does not invent salons", () => {
  const script = join(root, "scripts/isolated-e2e.mjs");
  assert.equal(existsSync(script), true);
  const source = readFileSync(script, "utf8");
  assert.match(source, /getByRole/);
  assert.match(source, /Muriaé/);
  assert.match(source, /Juiz de Fora/);
  assert.match(source, /BLOQUEADO/);
  assert.doesNotMatch(source, /agendeapp\.online/);
  assert.doesNotMatch(source, /estudio-luna/);
});
