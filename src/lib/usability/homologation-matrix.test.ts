import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  HOMOLOGATION_JOURNEYS,
  HOMOLOGATION_STATUSES,
  homologationCounts,
  homologationReadiness,
} from "./homologation-matrix";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

test("homologation board never marks a missing backend as PASS E2E or bare PASS", () => {
  const counts = homologationCounts();
  assert.equal(counts.fail, 0);
  assert.equal(counts.passE2e, 0);
  assert.ok(counts.passLocal >= 6);
  assert.ok(counts.blocked >= 8);
  assert.equal(counts.total, HOMOLOGATION_JOURNEYS.length);

  for (const row of HOMOLOGATION_JOURNEYS) {
    assert.ok(HOMOLOGATION_STATUSES.includes(row.status), row.id);
  }

  const rpc = HOMOLOGATION_JOURNEYS.find((row) => row.id === "client-search-city");
  assert.equal(rpc?.status, "BLOQUEADO");
  assert.equal(rpc?.owner, "Codex");
  const prodBook = HOMOLOGATION_JOURNEYS.find((row) => row.id === "client-booking-production");
  assert.equal(prodBook?.status, "BLOQUEADO");

  const sensitive = ["pro-signup-submit", "pro-agenda", "pro-services", "billing-checkout-test", "billing-portal-test"];
  for (const id of sensitive) {
    const row = HOMOLOGATION_JOURNEYS.find((item) => item.id === id);
    assert.ok(row, id);
    assert.notEqual(row?.status, "PASS E2E", id);
    if (id === "pro-agenda" || id === "pro-services") {
      assert.equal(row?.status, "PASS LOCAL");
    } else {
      assert.equal(row?.status, "BLOQUEADO");
    }
  }

  const readiness = homologationReadiness();
  assert.equal(readiness.realE2ePercent, 0);
  assert.equal(readiness.commercialReady, false);
  assert.equal(readiness.sensitiveJourneysReadyPercent, 0);
  assert.match(readiness.disclaimer, /PASS LOCAL não conta/);
});

test("isolated browser e2e uses roles, refuses production and does not invent salons", () => {
  const script = join(root, "scripts/isolated-e2e.mjs");
  assert.equal(existsSync(script), true);
  const source = readFileSync(script, "utf8");
  assert.match(source, /getByRole/);
  assert.match(source, /Muriaé/);
  assert.match(source, /Juiz de Fora/);
  assert.match(source, /BLOQUEADO/);
  assert.match(source, /scanEnvForProduction/);
  assert.match(source, /assertSafeE2eOrigin/);
  assert.match(source, /AGENDE_E2E_PORT/);
  assert.match(source, /AGENDE_E2E_EVIDENCE/);
  assert.match(source, /exitCodeFromResults/);
  assert.doesNotMatch(source, /\/opt\/cursor/);
  assert.doesNotMatch(source, /estudio-luna/);
  assert.doesNotMatch(source, /page\.goto\([^)]*agendeapp/);
  const lib = readFileSync(join(root, "scripts/e2e-lib.mjs"), "utf8");
  assert.match(lib, /agendeapp\.online/);
  assert.match(lib, /wohimauqgywshbbejjcl/);
});

test("staging suite stays blocked without opt-in and never targets production", () => {
  const script = join(root, "scripts/staging-e2e.mjs");
  assert.equal(existsSync(script), true);
  const source = readFileSync(script, "utf8");
  assert.match(source, /resolveStagingConfig/);
  assert.match(source, /PASS E2E/);
  assert.match(source, /BLOQUEADO/);
  assert.match(source, /AGENDE_STAGING_ALLOW_MUTATIONS/);
  assert.doesNotMatch(source, /page\.goto\([^)]*agendeapp/);
  assert.doesNotMatch(source, /cs_live_/);
});
