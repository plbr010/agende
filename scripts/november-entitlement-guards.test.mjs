import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

// Production received the November files before the October ones (rollout of
// 2026-11-09). The pilot migration then overwrote two November definitions.
const pilot = readFileSync('supabase/migrations/20261026120000_pilot_workspace_booking_activation.sql', 'utf8');
const restore = readFileSync('supabase/migrations/20261109130000_restore_november_entitlement_guards.sql', 'utf8');
const block = (name) => {
  const match = pilot.match(new RegExp(`CREATE OR REPLACE FUNCTION app\\.${name}\\([\\s\\S]*?\\n\\$\\$;`));
  assert.ok(match, name);
  return match[0];
};

test('restore migration brings back lifetime entitlement and the master-panel hold after an out-of-order rollout', async (t) => {
  const db = await createLocalDatabase();
  t.after(() => db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql', 'utf8'));
  const owner = (await db.query("select test_helpers.create_auth_user('owner@guards.invalid','professional',true) id")).rows[0].id;
  const salon = (await db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
    await tx.exec('set local role authenticated');
    return tx.query("select public.create_workspace('Salao Vitalicio',null,'equipe') data");
  })).rows[0].data.workspace_id;
  const held = (await db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
    await tx.exec('set local role authenticated');
    return tx.query("select public.create_workspace('Salao Suspenso',null,'equipe') data");
  })).rows[0].data.workspace_id;

  // Expired subscription + lifetime grant for one salon; master hold on the other.
  await db.query('set session_replication_role = replica');
  await db.query("update public.subscriptions set status='expired', trial_started_at=now()-interval '9 days', trial_ends_at=now()-interval '2 days' where workspace_id=$1", [salon]);
  await db.query('set session_replication_role = origin');
  await db.query('insert into app.lifetime_entitlements(workspace_id,granted_to,note) values($1,$2,$3)', [salon, owner, 'teste']);
  await db.query("insert into app.platform_account_holds(subject_type,subject_id,reason,created_by) values('workspace',$1,'teste de suspensao',$2)", [held, owner]);
  await db.query('select app.resume_booking_creation()');

  const entitled = async () => (await db.query('select app.workspace_has_entitlement($1) ok', [salon])).rows[0].ok;
  const heldError = async () => {
    try {
      await db.query('select app.assert_booking_creation_allowed($1)', [held]);
      return null;
    } catch (error) {
      await db.exec('rollback').catch(() => {});
      return error.message;
    }
  };

  assert.equal(await entitled(), true, 'version order keeps lifetime');
  assert.match(await heldError(), /workspace_suspended/);

  await db.exec(block('workspace_has_entitlement'));
  await db.exec(block('assert_booking_creation_allowed'));
  assert.equal(await entitled(), false, 'out-of-order rollout loses lifetime');
  assert.doesNotMatch((await heldError()) ?? '', /workspace_suspended/);

  await db.exec(restore);
  assert.equal(await entitled(), true, 'restore brings lifetime back');
  assert.match(await heldError(), /workspace_suspended/);
});
