import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

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
  for (const file of fn.source_files) verify(file.path, file.sha256);
}
const local = readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql"));
const remote = history.map(({ version, name }) => `${version}_${name}.sql`);
const missing = remote.filter((file) => !local.includes(file));
const extra = local.filter((file) => !remote.includes(file));
assert.equal(remote.length, 61);
assert.deepEqual(missing, ["20260919201138_hardening_snapshot_owner_timezone.sql"]);
// The snapshot is historical: later local migrations are reported, not rejected.
console.log({ local: local.length, remote: remote.length, missing, extra });
console.log("Verified against the read-only remote snapshot captured on 2026-09-26.");
