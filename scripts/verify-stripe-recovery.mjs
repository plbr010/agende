import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const manifest = JSON.parse(readFileSync("docs/migrations/remote-history-2026-09-26.json", "utf8"));
const history = JSON.parse(readFileSync("docs/migrations/inventory-2026-09-26.json", "utf8"));
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
assert.ok(local.length >= 61);
assert.equal(remote.length, 62);
assert.deepEqual(missing, ["20260919201138_hardening_snapshot_owner_timezone.sql"]);
assert.ok(extra.every(file => file > "20260926194038_trial_selected_plan.sql"), "Only later migrations may be added");
const trial = history.find(({ version }) => version === "20260926194038");
assert.ok(trial, "Applied trial migration must be in the remote snapshot");
assert.equal(trial.statement_count, 1);
verify(`supabase/migrations/${trial.version}_${trial.name}.sql`, trial.sha256);
console.log({ local: local.length, remote: remote.length, missing, extra });
console.log("Verified against the read-only remote snapshot captured on 2026-09-26.");
