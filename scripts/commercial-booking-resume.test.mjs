import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

function as(db, uid, sql, args = [], role = uid ? 'authenticated' : 'anon') {
  return db.transaction(async (tx) => {
    await tx.query(
      "select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role',$2,true)",
      [uid ?? '', role],
    );
    await tx.exec('set local role ' + role);
    return tx.query(sql, args);
  });
}

const privilegesSql = `
  select
    has_function_privilege('authenticated','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE') client,
    has_function_privilege('authenticated','public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text)','EXECUTE') team,
    has_function_privilege('anon','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE') anon,
    has_table_privilege('authenticated','public.appointments','INSERT') direct`;

test('commercial resume reopens booking for entitled salons only, and only for operators', async (t) => {
  const db = await createLocalDatabase();
  t.after(() => db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql', 'utf8'));
  await db.query('select app.suspend_booking_creation()');

  const user = async (name, intent = 'professional') =>
    (await db.query('select test_helpers.create_auth_user($1,$2,true) id', [`${name}@resume.invalid`, intent])).rows[0].id;
  const owner = await user('owner');
  const client = await user('client', 'client');
  const salon = (await as(db, owner, 'select public.create_workspace($1,null,$2) data', ['Salao Reabertura', 'equipe'])).rows[0].data.workspace_id;
  const member = (await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2', [salon, owner])).rows[0].id;
  const slug = (await db.query('select slug from public.workspaces where id=$1', [salon])).rows[0].slug;
  const service = (await as(db, owner, "insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Corte',60,8000) returning id", [salon])).rows[0].id;
  await as(db, owner, 'insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)', [salon, member, service]);
  await as(db, owner, "insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6) n", [salon, member]);
  const start = (await db.query("select (((clock_timestamp() at time zone 'America/Sao_Paulo')::date + 3) + time '10:00') at time zone 'America/Sao_Paulo' s")).rows[0].s;
  const book = "select public.create_public_appointment($1,$2,$3,$4,'Maria','+5532999991111','x@resume.invalid') data";

  await t.test('paused: nobody can book', async () => {
    assert.deepEqual((await db.query(privilegesSql)).rows[0], { client: false, team: false, anon: false, direct: false });
    await assert.rejects(as(db, client, book, [slug, service, member, start]), /permission denied/);
  });

  await t.test('authenticated and anon cannot resume, even with a mistaken grant', async () => {
    await assert.rejects(as(db, owner, 'select app.resume_booking_creation()'), /permission denied/);
    await assert.rejects(as(db, null, 'select app.resume_booking_creation()'), /permission denied/);
    await db.query('grant execute on function app.resume_booking_creation() to authenticated');
    try {
      await assert.rejects(as(db, owner, 'select app.resume_booking_creation()'), /booking_activation_denied|permission denied/);
    } finally {
      await db.query('revoke execute on function app.resume_booking_creation() from authenticated');
    }
    assert.equal((await db.query('select globally_paused from app.booking_creation_controls')).rows[0].globally_paused, true);
  });

  await t.test('operator resume grants authenticated only; anon and direct insert stay closed', async () => {
    await db.query('select app.resume_booking_creation()');
    assert.equal((await db.query('select globally_paused from app.booking_creation_controls')).rows[0].globally_paused, false);
    assert.deepEqual((await db.query(privilegesSql)).rows[0], { client: true, team: true, anon: false, direct: false });
  });

  await t.test('entitled salon accepts one booking and still rejects the overlapping one', async () => {
    const first = await as(db, client, book, [slug, service, member, start]);
    assert.ok(first.rows[0].data.appointment_id);
    const other = await user('client-2', 'client');
    await assert.rejects(as(db, other, book, [slug, service, member, start]), /overlap|slot_taken|slot_unavailable/);
    assert.equal((await db.query('select count(*)::int n from public.appointments where workspace_id=$1', [salon])).rows[0].n, 1);
  });

  await t.test('suspend remains the emergency brake after a resume', async () => {
    await db.query('select app.suspend_booking_creation()');
    assert.deepEqual((await db.query(privilegesSql)).rows[0], { client: false, team: false, anon: false, direct: false });
  });
});
