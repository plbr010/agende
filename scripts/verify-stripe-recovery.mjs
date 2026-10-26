import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const manifest = JSON.parse(readFileSync("docs/migrations/remote-history-2026-09-26.json", "utf8"));
const history = JSON.parse(readFileSync("docs/migrations/remote-inventory-2026-09-27.json", "utf8"));
function verify(path, expected, revision = null, normalizeLf = false) {
  const source = revision ? execFileSync("git", ["show", `${revision}:${path}`]) : readFileSync(path);
  const actual = createHash("sha256").update(normalizeLf ? source.toString("utf8").replaceAll("\r\n", "\n") : source).digest("hex");
  assert.equal(actual, expected, path);
  console.log(`${actual}  ${path}${revision ? " @ " + revision : ""}`);
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
assert.equal(remote.length, 63);
assert.deepEqual(missing, ["20260919201138_hardening_snapshot_owner_timezone.sql"]);
const previouslyReviewedLocalOnly = [
    "20260927014947_launch_readiness_reviews.sql",
    "20261008131859_launch_hardening_reviews_force_rls.sql",
    "20261009172028_launch_observed_owner_guard.sql",
    "20261009173042_billing_reconcile_excess_seats.sql",
    "20261010232248_atomic_service_professional_links.sql",
    "20261014030220_public_workspace_discovery.sql",
    "20261014172158_client_phase2_profiles_favorites.sql",
    "20261014173903_client_phase2_avatar_upload_cleanup.sql",
    "20261015054116_workspace_media_and_settings_contract.sql",
    "20261015054818_workspace_settings_validation.sql",
    "20261016075244_profiles_booking_whatsapp.sql",
    "20261016235000_require_confirmed_public_booking.sql",
    "20261020162935_launch_discovery_eligibility.sql",
];
// PR #89's merged manifest adds ten reviewed files (and repeats the historical
// owner guard above). Pin its commit: regenerating today's manifest must never
// silently approve an unknown migration or replace a reviewed checksum.
const reviewedRevision = "b6ce86c7e9717839d60c57bfe371e3d8d5915082";
const reviewedPlan = JSON.parse(execFileSync("git", [
  "show", `${reviewedRevision}:docs/production-readiness/launch-final-migration-plan.json`,
], { encoding: "utf8" }));
// Files that landed after the pinned manifest. Checksums are exact bytes.
// Adding a name to the current launch plan does not approve it.
const reconciledAfterReview = [
  ["20261026180100_expired_entitlement_appointment_cancel.sql", "0e28f1113cd2d27f356eef683cbf3aba239282222047e1b3b9c2e28f424de5dd"],
  ["20261026192015_reconcile_expired_cancellation.sql", "6f7c3a1e5b85d5136554d7973a69db82c3703eec111e19e98cca7e919cf04d8c"],
];
const reviewedLocalOnly = [...new Set([
  ...previouslyReviewedLocalOnly,
  ...reviewedPlan.pending.map(({ file }) => file),
  ...reconciledAfterReview.map(([file]) => file),
])].sort();
assert.deepEqual(
  extra.sort(), reviewedLocalOnly,
  "Only reviewed migrations may remain local-only versus the 2026-09-27 snapshot",
);
assert.equal(local.length, remote.length - missing.length + reviewedLocalOnly.length);
for (const migration of reviewedPlan.pending) {
  assert.match(migration.file, /^\d{14}_[a-z0-9_]+\.sql$/);
  assert.match(migration.sha256_lf, /^[0-9a-f]{64}$/);
  verify(`supabase/migrations/${migration.file}`, migration.sha256_lf, null, true);
}
for (const [file, sha256] of reconciledAfterReview) {
  assert.match(file, /^\d{14}_[a-z0-9_]+\.sql$/);
  assert.match(sha256, /^[0-9a-f]{64}$/);
  verify(`supabase/migrations/${file}`, sha256);
}
const trial = history.find(({ version }) => version === "20260926194038");
assert.ok(trial, "Applied trial migration must be in the remote snapshot");
assert.equal(trial.statement_count, 1);
verify(`supabase/migrations/${trial.version}_${trial.name}.sql`, trial.sha256);
const checkout = history.find(({ version }) => version === "20260927005815");
assert.equal(checkout?.name, "stripe_checkout_guards");
assert.equal(checkout.statement_count, 1);
verify(`supabase/migrations/${checkout.version}_${checkout.name}.sql`, checkout.sha256);
const deployed = JSON.parse(readFileSync("docs/migrations/edge-v2-2026-09-27.json", "utf8"));
assert.match(deployed.compared_pr_sha, /^[0-9a-f]{40}$/, "Historical comparison requires an exact commit");
for (const fn of deployed.functions) {
  assert.equal(fn.version, 2);
  assert.equal(fn.status, "ACTIVE");
  // This manifest proves the deployed historical version. Current source may
  // evolve in reviewed PRs; its behavior is verified by stripe-edge.test.mjs.
  // Never rewrite the historical hashes to make current files match.
  for (const file of fn.source_files) verify(file.path, file.sha256, deployed.compared_pr_sha);
}
console.log({ local: local.length, remote: remote.length, missing, extra });
console.log("Verified against the read-only remote snapshot captured on 2026-09-27 UTC.");
