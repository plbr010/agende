import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { encoding: 'utf8', windowsHide: true }).trim();
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agende-stripe-recovery-'));
  t.after(() => {
    const rel = relative(tmpdir(), root);
    assert.ok(rel.startsWith('agende-stripe-recovery-') && !rel.includes(sep), 'cleanup must stay in the owned temporary directory');
    rmSync(root, { recursive: true, force: true });
  });
  for (const dir of ['scripts', 'docs/migrations', 'docs/production-readiness', 'supabase']) mkdirSync(join(root, dir), { recursive: true });
  cpSync('supabase/migrations', join(root, 'supabase/migrations'), { recursive: true });
  cpSync('scripts/verify-stripe-recovery.mjs', join(root, 'scripts/verify-stripe-recovery.mjs'));
  for (const file of ['remote-history-2026-09-26.json', 'remote-inventory-2026-09-27.json', 'edge-v2-2026-09-27.json']) {
    cpSync('docs/migrations/' + file, join(root, 'docs/migrations', file));
  }
  const run = () => spawnSync(process.execPath, ['scripts/verify-stripe-recovery.mjs'], {
    cwd: root, encoding: 'utf8', windowsHide: true,
    env: { ...process.env, GIT_DIR: gitDir, GIT_WORK_TREE: root },
  });
  return { root, run, sql: file => join(root, 'supabase/migrations', file) };
}
function rejects(result, message) {
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, message);
}

test('Stripe recovery accepts the reviewed inventory and preserves historical edge hashes', t => {
  const { run } = fixture(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /local: 85/);
  assert.match(result.stdout, /remote: 63/);
  assert.match(result.stdout, /Verified against the read-only remote snapshot/);
  assert.match(result.stdout, /stripe-webhook\/index\.ts @ [0-9a-f]{40}/);
});
test('Stripe recovery refuses an unreviewed migration even if the current manifest approves it', t => {
  const { root, run, sql } = fixture(t);
  const file = '20990101000000_unreviewed.sql';
  writeFileSync(sql(file), 'select 1;\n');
  const plan = JSON.parse(readFileSync('docs/production-readiness/launch-final-migration-plan.json', 'utf8'));
  plan.pending.push({ file, version: file.slice(0, 14), sha256_lf: '0'.repeat(64) });
  writeFileSync(join(root, 'docs/production-readiness/launch-final-migration-plan.json'), JSON.stringify(plan));
  rejects(run(), /Only reviewed migrations/);
});
test('Stripe recovery refuses removal of a snapshot migration', t => {
  const { run, sql } = fixture(t);
  rmSync(sql('20260918150334_foundation_types_and_tables.sql'));
  rejects(run(), /20260918150334_foundation_types_and_tables\.sql/);
});
test('Stripe recovery refuses a fabricated replacement for the remote-only migration', t => {
  const { run, sql } = fixture(t);
  writeFileSync(sql('20260919201138_hardening_snapshot_owner_timezone.sql'), '-- fabricated placeholder\n');
  rejects(run(), /20260919201138_hardening_snapshot_owner_timezone\.sql/);
});
test('Stripe recovery refuses changes to recovered Stripe SQL', t => {
  const { run, sql } = fixture(t);
  writeFileSync(sql('20260926062411_stripe_billing_sync_foundation.sql'), 'select 1;\n');
  rejects(run(), /stripe_billing_sync_foundation\.sql/);
});
test('Stripe recovery refuses changes to the newly reviewed migration SQL', t => {
  const { run, sql } = fixture(t);
  writeFileSync(sql('20261026091115_expired_appointment_cancellation.sql'), 'select 1;\n');
  rejects(run(), /expired_appointment_cancellation\.sql/);
});
test('Stripe recovery still refuses a changed historical Edge Function checksum', t => {
  const { root, run } = fixture(t);
  const path = join(root, 'docs/migrations/edge-v2-2026-09-27.json');
  const snapshot = JSON.parse(readFileSync(path, 'utf8'));
  snapshot.functions[0].source_files[0].sha256 = '0'.repeat(64);
  writeFileSync(path, JSON.stringify(snapshot));
  rejects(run(), /AssertionError/);
});
