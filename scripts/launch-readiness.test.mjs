import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

test('launch readiness SQL: reviews, rescheduling, roles and timezone', async t => {
  const db = await createLocalDatabase();
  t.after(() => db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql','utf8'));
  let n=0;
  const user = async intent => (await db.query("select test_helpers.create_auth_user($1,$2,true) id",[`launch-${n++}@agende-local.test`,intent])).rows[0].id;
  const as = (uid,sql,params=[]) => db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[uid]);
    await tx.exec('set local role authenticated');
    return tx.query(sql,params);
  });
  const owner=await user('professional'), client=await user('client'), foreign=await user('client');
  const workspace=(await as(owner,"select public.create_workspace('Launch SQL',null,'equipe') result")).rows[0].result.workspace_id;
  const member=(await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2',[workspace,owner])).rows[0].id;
  const service=(await as(owner,"insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Corte',60,8000) returning id",[workspace])).rows[0].id;
  await as(owner,'insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)',[workspace,member,service]);
  await as(owner,"insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6) n",[workspace,member]);
  const cid=(await db.query("insert into public.workspace_clients(workspace_id,full_name,email) values($1,'Cliente E2E',(select email from auth.users where id=$2)) returning id",[workspace,client])).rows[0].id;
  const date=(await db.query("select ((clock_timestamp() at time zone 'America/Sao_Paulo')::date+3)::text d")).rows[0].d;
  const start=(await db.query("select ($1::date+time '10:00') at time zone 'America/Sao_Paulo' t",[date])).rows[0].t;
  const create = async hour => (await as(owner,"select public.create_appointment($1,$2,$3,$4,($5::date+$6::time) at time zone 'America/Sao_Paulo',null) id",[workspace,cid,member,service,date,hour])).rows[0].id;
  const appointment=await create('10:00'), occupied=await create('14:00');
  await t.test('client read model exposes stable IDs and slots preserve appointment duration', async () => {
    const rows=(await as(client,'select public.list_my_appointments() data')).rows[0].data;
    assert.equal(rows.find(a=>a.id===appointment).service_id,service);
    assert.equal(rows.find(a=>a.id===appointment).professional_member_id,member);
    await as(owner,'update public.services set duration_minutes=30 where id=$1',[service]);
    const slots=(await as(client,'select * from public.list_my_reschedule_slots($1,$2,$3)',[appointment,member,date])).rows.map(r=>new Date(r.starts_at).toISOString());
    assert.ok(slots.includes(new Date(start).toISOString()),'own slot is not a conflict');
    assert.ok(!slots.includes(date+'T16:30:00.000Z'),'13:30 overlaps 14:00 when original duration is 60min');
    assert.ok(!slots.includes(date+'T20:30:00.000Z'),'17:30 cannot fit original duration before 18:00');
  });
  await t.test('client reschedule rejects unavailable slots and IDOR, then updates same instant safely', async () => {
    await assert.rejects(as(foreign,'select * from public.list_my_reschedule_slots($1,$2,$3)',[appointment,member,date]),/appointment_not_found/);
    await assert.rejects(as(foreign,"select public.reschedule_my_appointment($1,$2,$3)",[appointment,date+'T15:00:00Z',member]),/appointment_not_found/);
    await assert.rejects(as(client,"select public.reschedule_my_appointment($1,$2,$3)",[appointment,date+'T17:00:00Z',member]),/appointment_overlap|slot_taken/);
    await as(client,"select public.reschedule_my_appointment($1,$2,$3)",[appointment,date+'T15:00:00Z',member]);
    const row=(await db.query('select * from public.appointments where id=$1',[appointment])).rows[0];
    assert.equal(new Date(row.starts_at).toISOString(),date+'T15:00:00.000Z');
    assert.equal(row.duration_minutes,60);
  });
  await t.test('timezone changes display and slots without changing stored appointment instant', async () => {
    const before=(await db.query('select starts_at from public.appointments where id=$1',[appointment])).rows[0].starts_at;
    for(const [zone,hour] of [['America/Sao_Paulo',12],['America/Manaus',11]]) {
      await db.transaction(async tx => {
        await tx.exec("select set_config('app.bypass_protected_columns','on',true)");
        await tx.query('update public.workspace_settings set timezone=$1 where workspace_id=$2',[zone,workspace]);
      });
      const row=(await as(client,'select public.list_my_appointments() data')).rows[0].data.find(a=>a.id===appointment);
      assert.equal(row.timezone,zone);
      const local=(await db.query('select extract(hour from starts_at at time zone $1)::int h,starts_at from public.appointments where id=$2',[zone,appointment])).rows[0];
      assert.equal(local.h,hour); assert.equal(new Date(local.starts_at).getTime(),new Date(before).getTime());
      const slots=(await as(owner,'select * from public.list_available_slots($1,$2,$3,$4)',[workspace,member,service,date])).rows;
      assert.equal(new Date(slots[0].starts_at).getUTCHours(),zone==='America/Manaus'?12:11);
    }
  });
  await t.test('review rejects incomplete and foreign appointments', async () => {
    await assert.rejects(as(client,'select public.submit_appointment_review($1,5,null)',[appointment]),/appointment_not_completed/);
    await assert.rejects(as(foreign,'select public.submit_appointment_review($1,5,null)',[appointment]),/appointment_not_found/);
    await assert.rejects(as(owner,'select public.submit_appointment_review($1,5,null)',[appointment]),/appointment_not_found/);
  });
  for(const status of ['confirmed','in_progress','completed']) await as(owner,'select public.set_appointment_status($1,$2::public.appointment_status)',[appointment,status]);
  await t.test('review validates rating/comment, persists once and rejects duplicates', async () => {
    for(const rating of [null,0,6]) await assert.rejects(as(client,'select public.submit_appointment_review($1,$2,null)',[appointment,rating]),/invalid_rating/);
    await assert.rejects(as(client,'select public.submit_appointment_review($1,5,$2)',[appointment,'x'.repeat(501)]),/review_comment_too_long/);
    const r=(await as(client,"select public.submit_appointment_review($1,5,' Excelente ') data",[appointment])).rows[0].data;
    assert.equal(r.comment,'Excelente'); assert.equal(r.rating,5);
    await assert.rejects(as(client,'select public.submit_appointment_review($1,4,null)',[appointment]),/already_reviewed/);
  });
  await t.test('review RLS isolates tenants and prohibits all direct writes, edits and deletes', async () => {
    assert.equal((await as(client,'select * from public.appointment_reviews')).rows.length,1);
    assert.equal((await as(owner,'select * from public.appointment_reviews where workspace_id=$1',[workspace])).rows.length,1);
    assert.equal((await as(foreign,'select * from public.appointment_reviews')).rows.length,0);
    for(const uid of [owner,client,foreign]) {
      await assert.rejects(as(uid,'update public.appointment_reviews set rating=1'),/permission denied/);
      await assert.rejects(as(uid,'delete from public.appointment_reviews'),/permission denied/);
      await assert.rejects(as(uid,'insert into public.appointment_reviews(appointment_id,workspace_id,client_user_id,rating) values($1,$2,$3,5)',[occupied,workspace,uid]),/permission denied/);
    }
    await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');await tx.query('select * from public.appointment_reviews');}),/permission denied/);
    await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');await tx.query('select public.submit_appointment_review($1,5,null)',[appointment]);}),/permission denied/);
  });
  await t.test('appointment_reviews uses FORCE RLS and SECURITY DEFINER functions pin empty search_path', async () => {
    const rls=(await db.query("select c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='appointment_reviews'")).rows[0];
    assert.equal(rls.relrowsecurity, true);
    assert.equal(rls.relforcerowsecurity, true);
    const missing=(await db.query(`
      select n.nspname, p.proname
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where p.prosecdef
        and n.nspname in ('app','public')
        and (
          p.proconfig is null
          or not exists (
            select 1 from unnest(p.proconfig) as cfg(value)
            where cfg.value like 'search_path=%'
          )
        )
    `)).rows;
    assert.deepEqual(missing, []);
    const publicExecute=(await db.query(`
      select grantee, routine_name
      from information_schema.routine_privileges
      where specific_schema='public'
        and routine_name in ('submit_appointment_review','list_my_reschedule_slots')
        and privilege_type='EXECUTE'
        and grantee in ('PUBLIC','anon')
    `)).rows;
    assert.deepEqual(publicExecute, []);
  });
});

