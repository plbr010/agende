import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const manifest = JSON.parse(readFileSync("docs/migrations/remote-history-2026-09-26.json", "utf8"));
const history = JSON.parse(readFileSync("docs/migrations/remote-inventory-2026-09-27.json", "utf8"));
function verify(path, expected) {
  const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
  assert.equal(actual, expected, path);
  console.log(`${actual}  ${path}`);
}
for (const migration of manifest.migrations) {
  assert.equal(migration.statement_count, 1);
  const remote = history.find(({ version }) => version === migration.version);
  assert.deepEqual(remote, migration);
  verify(`supabase/migrations/${migration.version}_${migration.name}.sql`, remote.sha256);
}
for (const fn of manifest.functions) {
  // Recovery is a historical assertion. Current entrypoints are intentionally
  // evolved by the checkout integration; never rewrite the recovered manifest.
  for (const file of fn.source_files) {
    const original = execFileSync("git", ["show", `09e866864d12ae63be26bd0759a8886b8cefe719:${file.path}`]);
    assert.equal(createHash("sha256").update(original).digest("hex"), file.sha256, file.path);
  }
}
const local = readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql"));
const remote = history.map(({ version, name }) => `${version}_${name}.sql`);
const missing = remote.filter((file) => !local.includes(file));
const extra = local.filter((file) => !remote.includes(file));
assert.equal(local.length, 62);
assert.equal(remote.length, 63);
assert.deepEqual(missing, ["20260919201138_hardening_snapshot_owner_timezone.sql"]);
assert.deepEqual(extra, [], "No local-only migrations may remain after reconciliation");
const trial = history.find(({ version }) => version === "20260926194038");
assert.ok(trial, "Applied trial migration must be in the remote snapshot");
assert.equal(trial.statement_count, 1);
verify(`supabase/migrations/${trial.version}_${trial.name}.sql`, trial.sha256);
const checkout = history.find(({ version }) => version === "20260927005815");
assert.equal(checkout?.name, "stripe_checkout_guards");
assert.equal(checkout.statement_count, 1);
verify(`supabase/migrations/${checkout.version}_${checkout.name}.sql`, checkout.sha256);
const deployed = JSON.parse(readFileSync("docs/migrations/edge-v2-2026-09-27.json", "utf8"));
for (const fn of deployed.functions) {
  assert.equal(fn.version, 2);
  assert.equal(fn.status, "ACTIVE");
  for (const file of fn.source_files) verify(file.path, file.sha256);
}
console.log({ local: local.length, remote: remote.length, missing, extra });
console.log("Verified against the read-only remote snapshot captured on 2026-09-27 UTC.");
