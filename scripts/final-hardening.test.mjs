import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

const remote = JSON.parse(readFileSync('docs/migrations/remote-final-2026-10-09.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261009172028_launch_observed_owner_guard.sql', 'utf8');
const names = ['lock_workspace_membership', 'assert_member_change_allowed', 'update_workspace_member_role',
  'deactivate_workspace_member', 'reactivate_workspace_member', 'remove_workspace_member', 'enforce_active_owner'];
const observed = names.map(name => remote.functions.find(f => f.schema === 'app' && f.name === name));
const definitions = db => db.query("select proname,replace(pg_get_functiondef(p.oid),chr(13),'') body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and proname=any($1) order by proname", [names]);
const as = (db, uid, sql, params = []) => db.transaction(async tx => {
  await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [uid]);
  await tx.exec('set local role authenticated'); return tx.query(sql, params);
});
const service = (db, sql, params = []) => db.transaction(async tx => {
  await tx.exec('set local role service_role'); return tx.query(sql, params);
});
async function ownerFixture(db) {
  await db.exec(readFileSync('supabase/tests/helpers.sql', 'utf8'));
  const uid = (await db.query("select test_helpers.create_auth_user('owner@final-local.invalid','professional',true) id")).rows[0].id;
  const wid = (await as(db, uid, "select public.create_workspace('Hardening local',null,'equipe') result")).rows[0].result.workspace_id;
  return { uid, wid };
}

test('pending migrations dry-run on the observed remote membership state preserves data and definitions', async t => {
  const db = await createLocalDatabase({ throughVersion: '20260927005815' }); t.after(() => db.close());
  const { wid } = await ownerFixture(db);
  for (const fn of observed) await db.exec(fn.body);
  await db.exec(remote.triggers.find(t => t.name === 'workspace_members_keep_owner').definition);
  const before = (await definitions(db)).rows;
  const trial = (await db.query('select trial_started_at,trial_ends_at from public.subscriptions where workspace_id=$1', [wid])).rows[0];
  await db.transaction(async tx => {
    await tx.exec("set local search_path=''");
    await tx.exec(readFileSync('supabase/migrations/20260927014947_launch_readiness_reviews.sql', 'utf8'));
    await tx.exec(readFileSync('supabase/migrations/20261008131859_launch_hardening_reviews_force_rls.sql', 'utf8'));
    await tx.exec(migration);
    await tx.exec(readFileSync('supabase/migrations/20261009173042_billing_reconcile_excess_seats.sql', 'utf8'));
  });
  assert.deepEqual((await definitions(db)).rows, before, 'observed remote bodies must not be overwritten');
  assert.deepEqual((await db.query('select trial_started_at,trial_ends_at from public.subscriptions where workspace_id=$1', [wid])).rows[0], trial);
  assert.equal((await db.query("select relforcerowsecurity from pg_class where oid='public.appointment_reviews'::regclass")).rows[0].relforcerowsecurity, true);
  await db.exec(migration);
  await db.exec(readFileSync('supabase/migrations/20261009173042_billing_reconcile_excess_seats.sql', 'utf8'));
  assert.deepEqual((await definitions(db)).rows, before, 'forward guard migration is idempotent');
});

test('owner reconciliation refuses unknown functions and rolls back all changes', async t => {
  const db = await createLocalDatabase({ throughVersion: '20261008131859' }); t.after(() => db.close());
  await db.exec("create function app.enforce_active_owner() returns trigger language plpgsql as $$ begin return new; end $$");
  await assert.rejects(db.transaction(tx => tx.exec(migration)), /unexpected_definition/);
  assert.equal((await db.query("select to_regprocedure('app.lock_workspace_membership(uuid)') fn")).rows[0].fn, null);
});

test('last-owner trigger protects direct privileged writes and RPCs retain tenant and role checks', async t => {
  const db = await createLocalDatabase(); t.after(() => db.close());
  const { uid, wid } = await ownerFixture(db);
  const member = (await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2', [wid, uid])).rows[0].id;
  for (const sql of ["update public.workspace_members set status='inactive' where id=$1", "update public.workspace_members set role='admin' where id=$1"]) {
    await assert.rejects(db.transaction(async tx => {
      await tx.exec("select set_config('app.bypass_protected_columns','on',true)"); await tx.query(sql, [member]);
    }), /last_owner_protected/);
  }
  await assert.rejects(as(db, uid, 'select public.deactivate_workspace_member($1,$2)', [wid, member]), /last_owner_protected/);
  await assert.rejects(as(db, uid, "select public.update_workspace_member_role($1,$2,'admin')", [wid, member]), /last_owner_protected/);
  const outsider = (await db.query("select test_helpers.create_auth_user('outsider@final-local.invalid','professional',true) id")).rows[0].id;
  await assert.rejects(as(db, outsider, 'select public.remove_workspace_member($1,$2)', [wid, member]), /not_authorized/);
  for (const fn of observed) {
    const local = (await definitions(db)).rows.find(f => f.proname === fn.name);
    assert.equal(local.body, fn.body);
  }
});

test('expiry and payment failure block operational access even before the maintenance job runs', async t => {
  const db = await createLocalDatabase(); t.after(() => db.close());
  const { uid, wid } = await ownerFixture(db);
  await db.transaction(async tx => {
    await tx.exec("select set_config('app.bypass_protected_columns','on',true)");
    await tx.query("update public.subscriptions set trial_started_at=now()-interval '7 days',trial_ends_at=now() where workspace_id=$1", [wid]);
  });
  assert.equal((await db.query('select app.workspace_has_entitlement($1) ok', [wid])).rows[0].ok, false);
  for (const sql of ["select public.get_inventory_ui($1)", "select public.get_packages_ui($1)", "select public.get_finance_ui($1,current_date,current_date)", "select public.create_inventory_product($1,'Blocked')", "select public.change_trial_plan($1,'solo')"]) {
    await assert.rejects(as(db, uid, sql, [wid]), /workspace_subscription_inactive|trial/);
  }
  await service(db, "select public.bind_billing_customer($1,'stripe','cus_local_final')", [wid]);
  for (const status of ['active', 'past_due', 'active', 'canceled']) {
    await service(db, "select public.sync_billing_subscription($1,'stripe','cus_local_final','sub_local_final','equipe','annual',$2,now(),now()+interval '1 year',null)", [wid, status]);
    assert.equal((await db.query('select app.workspace_has_entitlement($1) ok', [wid])).rows[0].ok, status === 'active');
  }
});

test('paid downgrade with excess seats never retains active access and never blocks cancellation or failed payment', async t => {
  const db = await createLocalDatabase(); t.after(() => db.close());
  const { uid, wid } = await ownerFixture(db);
  const professional = (await db.query("select test_helpers.create_auth_user('professional@final-local.invalid','professional',true) id")).rows[0].id;
  await db.query("insert into public.workspace_members(workspace_id,user_id,role,status) values($1,$2,'professional','active')", [wid, professional]);
  await service(db, "select public.bind_billing_customer($1,'stripe','cus_seats')", [wid]);
  const sync = (plan, status) => service(db, "select public.sync_billing_subscription($1,'stripe','cus_seats','sub_seats',$2,'monthly',$3,now(),now()+interval '1 month',null)", [wid, plan, status]);
  await sync('equipe', 'active');
  const original = (await db.query('select trial_started_at,trial_ends_at from public.subscriptions where workspace_id=$1', [wid])).rows[0];
  for (const status of ['canceled', 'past_due', 'active', 'trialing']) {
    await sync('equipe', 'active');
    await sync('solo', status);
    const row = (await db.query('select plan,status,trial_started_at,trial_ends_at from public.subscriptions where workspace_id=$1', [wid])).rows[0];
    assert.equal(row.plan, 'solo');
    assert.equal(row.status, ['active','trialing'].includes(status) ? 'expired' : status);
    assert.equal((await db.query('select app.workspace_has_entitlement($1) ok', [wid])).rows[0].ok, false);
    assert.deepEqual({ trial_started_at: row.trial_started_at, trial_ends_at: row.trial_ends_at }, original);
  }
  await sync('equipe', 'active');
  assert.equal((await db.query('select app.workspace_has_entitlement($1) ok', [wid])).rows[0].ok, true);
  const event = "select public.record_billing_event($1,'stripe','evt_duplicate_final','invoice.paid',8990,'BRL','monthly','paid') id";
  const first = (await service(db, event, [wid])).rows[0].id;
  assert.equal((await service(db, event, [wid])).rows[0].id, first);
  assert.equal((await db.query("select count(*)::int n from public.billing_events where external_event_id='evt_duplicate_final'")).rows[0].n, 1);
  await assert.rejects(as(db, uid, event, [wid]), /permission denied/);
});
