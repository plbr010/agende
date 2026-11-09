import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync } from "node:fs";
import { buildRollout, PRODUCTION_PENDING, PRODUCTION_PENDING_SHA256 } from "./build-production-rollout.mjs";

test("production rollout bundles every pending migration once, in version order, with pinned checksums", () => {
  const local = new Set(readdirSync("supabase/migrations").map((f) => f.replace(/\.sql$/, "")));
  assert.deepEqual([...PRODUCTION_PENDING].sort(), PRODUCTION_PENDING);
  for (const file of PRODUCTION_PENDING) {
    assert.ok(local.has(file), file);
    assert.match(PRODUCTION_PENDING_SHA256[file] ?? "", /^[0-9a-f]{64}$/, file);
  }
  const sql = buildRollout();
  assert.equal(sql.match(/insert into supabase_migrations\.schema_migrations/g).length, PRODUCTION_PENDING.length);
  assert.match(sql, /^begin;$/m);
  assert.match(sql, /rollout_precondition/);
  assert.match(sql, /set_config\('app\.bypass_entitlement','on',true\)/);
  assert.match(sql, /commit;\n$/);
  assert.match(buildRollout({ commit: false }), /rollback;\n$/);
  // The bundle never flips the booking switch by itself.
  const code = sql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(code, /select app\.resume_booking_creation\(\)/);
});
