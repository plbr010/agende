import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

test('expired trial and courtesy preserve cancellation only, with tenant and role checks', async t => {
  const db = await createLocalDatabase(); t.after(() => db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql', 'utf8'));
  const as = (uid, sql, args = [], role = 'authenticated') => db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)", [uid ?? '', role]);
    await tx.exec('set local role ' + role); return tx.query(sql, args);
  });
  let n = 0;
  const user = async (intent = 'professional', confirmed = true) => (await db.query(
    'select test_helpers.create_auth_user($1,$2,$3) id', [`cancel-${n++}@local.invalid`, intent, confirmed],
  )).rows[0].id;
  const owner = await user(), foreign = await user(), client = await user('client');
  const stranger = await user('client'), unconfirmed = await user('client', false);
  const proUser = await user(), otherProUser = await user(), receptionist = await user();
  const workspace = (await as(owner, "select public.create_workspace('Expired Pilot',null,'equipe') data")).rows[0].data.workspace_id;
  await as(foreign, "select public.create_workspace('Foreign Salon',null,'equipe')");
  await db.query("insert into public.workspace_members(workspace_id,user_id,role,status) values($1,$2,'professional','active'),($1,$3,'professional','active'),($1,$4,'receptionist','active')", [workspace, proUser, otherProUser, receptionist]);
  const member = async uid => (await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2', [workspace, uid])).rows[0].id;
  const pro = await member(proUser), receptionMember = await member(receptionist);
  const service = (await db.query("insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Corte',30,8000) returning id", [workspace])).rows[0].id;
  await db.query('insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)', [workspace, pro, service]);
  await db.query("insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6)n", [workspace, pro]);
  const contact = (await db.query("insert into public.workspace_clients(workspace_id,full_name,email,linked_user_id) values($1,'Cliente',(select email from auth.users where id=$2),$2) returning id", [workspace, client])).rows[0].id;
  const ids = [];
  for (let i = 0; i < 9; i++) ids.push((await as(owner, "select public.create_appointment($1,$2,$3,$4,((current_date+3+$5::int)+time '10:00') at time zone 'America/Sao_Paulo',null) id", [workspace, contact, pro, service, i])).rows[0].id);
  await as(owner, "select public.set_appointment_status($1,'confirmed')", [ids[3]]);
  await as(owner, "select public.set_appointment_status($1,'in_progress')", [ids[3]]);
  await as(owner, "select public.set_appointment_status($1,'completed')", [ids[3]]);
  await db.query('select app.suspend_booking_creation()');
  await db.query("select app.activate_workspace_booking($1,now()+interval '2 days','synthetic expiry test')", [workspace]);
  await db.query("select set_config('app.bypass_protected_columns','on',false)");
  await db.query("update public.subscriptions set trial_started_at=now()-interval '8 days',trial_ends_at=now()-interval '1 day' where workspace_id=$1", [workspace]);
  await db.query("select set_config('app.bypass_protected_columns','off',false)");
  await db.query("update app.complimentary_entitlements set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' where workspace_id=$1", [workspace]);
  await db.query("update app.booking_workspace_exceptions set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where workspace_id=$1", [workspace]);
  assert.equal((await db.query('select app.workspace_has_entitlement($1) entitled', [workspace])).rows[0].entitled, false);
  const subscription = (await db.query('select * from public.subscriptions where workspace_id=$1', [workspace])).rows[0];
  const moneyBefore = (await db.query('select * from public.financial_entries order by id')).rows;

  await t.test('client cancels after both grants expire without changing the reservation snapshot', async () => {
    const before = (await db.query('select to_jsonb(a)-\'status\'-\'updated_at\' data from public.appointments a where id=$1', [ids[0]])).rows[0].data;
    const result = (await as(client, 'select public.cancel_my_appointment($1) data', [ids[0]])).rows[0].data;
    assert.equal(result.status, 'cancelled');
    assert.deepEqual((await db.query('select to_jsonb(a)-\'status\'-\'updated_at\' data from public.appointments a where id=$1', [ids[0]])).rows[0].data, before);
  });
  await t.test('owner cancellation and retry work without entitlement', async () => {
    await as(owner, "select public.set_appointment_status($1,'cancelled')", [ids[1]]);
    const updated = (await db.query('select updated_at from public.appointments where id=$1', [ids[1]])).rows[0].updated_at;
    await as(owner, "select public.set_appointment_status($1,'cancelled')", [ids[1]]);
    assert.equal(String((await db.query('select updated_at from public.appointments where id=$1', [ids[1]])).rows[0].updated_at), String(updated));
  });
  await t.test('foreign owner, unrelated client, unconfirmed and anon are rejected', async () => {
    await assert.rejects(as(foreign, "select public.set_appointment_status($1,'cancelled')", [ids[2]]), /not_authorized/);
    await assert.rejects(as(stranger, 'select public.cancel_my_appointment($1)', [ids[2]]), /appointment_not_found/);
    await assert.rejects(as(unconfirmed, 'select public.cancel_my_appointment($1)', [ids[2]]), /email_not_confirmed/);
    await assert.rejects(as(null, 'select public.cancel_my_appointment($1)', [ids[2]], 'anon'), /permission denied/);
  });
  await t.test('permission denies and professional scope remain enforced', async () => {
    await db.query("insert into public.workspace_member_permissions(workspace_id,member_id,permission_key,effect) values($1,$2,'appointments.cancel','deny')", [workspace, receptionMember]);
    await assert.rejects(as(receptionist, "select public.set_appointment_status($1,'cancelled')", [ids[2]]), /not_authorized/);
    await assert.rejects(as(otherProUser, "select public.set_appointment_status($1,'cancelled')", [ids[2]]), /appointment_write_denied|not_authorized/);
    await as(proUser, "select public.set_appointment_status($1,'cancelled')", [ids[2]]);
  });
  await t.test('terminal appointments and repeated customer cancellation stay blocked', async () => {
    await assert.rejects(as(owner, "select public.set_appointment_status($1,'cancelled')", [ids[3]]), /appointment_terminal/);
    await assert.rejects(as(client, 'select public.cancel_my_appointment($1)', [ids[3]]), /appointment_not_cancellable/);
    await assert.rejects(as(client, 'select public.cancel_my_appointment($1)', [ids[0]]), /appointment_not_cancellable/);
  });
  await t.test('client lead-time rule still applies after entitlement expires', async () => {
    // Simulate a larger cancellation lead window within a rolled-back local
    // transaction. Auth/ownership are real SQL roles; no production clock changes.
    await assert.rejects(db.transaction(async tx => {
      await tx.exec("create or replace function app.client_cancel_lead_minutes() returns integer language sql immutable set search_path='' as $$ select 525600 $$");
      await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[client]);
      await tx.exec('set local role authenticated');
      await tx.query('select public.cancel_my_appointment($1)',[ids[7]]);
    }), /cancel_too_late/);
  });
  await t.test('creation, reschedule, confirmation and reopening remain denied', async () => {
    await assert.rejects(as(owner, "select public.create_appointment($1,$2,$3,$4,now()+interval '30 days',null)", [workspace, contact, pro, service]), /workspace_subscription_inactive|permission denied/);
    await assert.rejects(as(owner, "select public.reschedule_appointment($1,$2,$3,now()+interval '20 days',null)", [ids[4], pro, service]), /workspace_subscription_inactive/);
    await assert.rejects(as(owner, "select public.set_appointment_status($1,'confirmed')", [ids[4]]), /workspace_subscription_inactive/);
    await assert.rejects(as(owner, "select public.set_appointment_status($1,'scheduled')", [ids[1]]), /workspace_subscription_inactive|appointment_terminal/);
    await assert.rejects(db.query("update public.appointments set status='cancelled',notes='also edit' where id=$1", [ids[4]]), /workspace_subscription_inactive/);
    await assert.rejects(db.query("update public.appointments set status='cancelled',starts_at=starts_at+interval '1 hour',ends_at=ends_at+interval '1 hour' where id=$1", [ids[4]]), /workspace_subscription_inactive/);
    await assert.rejects(as(owner, "update public.appointments set status='cancelled' where id=$1", [ids[4]]), /permission denied/);
  });
  await t.test('explicit deactivation also preserves only cancellation and financial records', async () => {
    await db.query('select app.deactivate_workspace_booking($1)', [workspace]);
    await as(owner, "select public.set_appointment_status($1,'cancelled')", [ids[4]]);
    await as(client, 'select public.cancel_my_appointment($1)', [ids[5]]);
    assert.deepEqual((await db.query('select * from public.subscriptions where workspace_id=$1', [workspace])).rows[0], subscription);
    assert.deepEqual((await db.query('select * from public.financial_entries order by id')).rows, moneyBefore);
    assert.equal((await db.query('select count(*)::int n from public.appointments')).rows[0].n, ids.length);
    const privileges = (await db.query("select has_function_privilege('authenticated','public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text)','EXECUTE') allowed")).rows[0];
    assert.equal(privileges.allowed, false);
  });
  await t.test('a concurrent start cannot be overwritten by client cancellation', { skip: !db.native }, async () => {
    const connection = await db.connection('cancel-race');
    const waiting = await db.connection('cancel-waiter');
    try {
      const blocker=(await connection.query('select pg_backend_pid() id')).rows[0].id;
      const waiter=(await waiting.query('select pg_backend_pid() id')).rows[0].id;
      await connection.query('begin');
      // A privileged operational session starts the appointment before the client
      // acquires its row lock. No entitlement/grant is changed in the application.
      await connection.query("set local app.bypass_entitlement='on'");
      await connection.query("update public.appointments set status='in_progress' where id=$1", [ids[6]]);
      await waiting.query('begin');
      await waiting.query("set local statement_timeout='8s'");
      await waiting.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[client]);
      await waiting.query('set local role authenticated');
      const cancellation = waiting.query('select public.cancel_my_appointment($1)', [ids[6]]);
      const rejected = assert.rejects(cancellation, /appointment_not_cancellable/);
      let blocked=false;
      for(let i=0;i<100;i++){
        const row=(await db.query('select pg_blocking_pids($1) blockers',[waiter])).rows[0];
        if(row.blockers.includes(blocker)){blocked=true;break;}
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      await connection.query('commit');
      await rejected;
      assert.equal(blocked,true,'must observe a genuine row-lock wait');
      assert.equal((await db.query('select status from public.appointments where id=$1', [ids[6]])).rows[0].status, 'in_progress');
    } finally {
      await connection.query('rollback').catch(() => {}); await connection.end();
      await waiting.query('rollback').catch(() => {}); await waiting.end();
    }
  });
});
