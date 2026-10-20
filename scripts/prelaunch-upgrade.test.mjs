import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createLocalDatabase } from './local-database.mjs';

test('five-migration upgrade preserves existing tenants and bookings; emergency gate is reversible without anon', async t => {
  const manifest=JSON.parse(readFileSync('docs/production-readiness/prelaunch20-migration-manifest.json','utf8'));
  const canonical=file=>readFileSync(file,'utf8').replaceAll('\r\n','\n');
  const hash=source=>createHash('sha256').update(source).digest('hex');
  assert.equal(manifest.migrations.length,5);
  for(const source of manifest.migrations) assert.equal(hash(canonical('supabase/migrations/'+source.file)),source.sha256,'reviewed migration source changed');
  assert.equal(hash(canonical('docs/production-readiness/prelaunch20-apply-five.sql')),manifest.bundle_sha256,'reviewed bundle changed');
  const db = await createLocalDatabase({ throughVersion: '20261014173903' });
  t.after(() => db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql', 'utf8'));
  const uid = (await db.query("select test_helpers.create_auth_user('upgrade@local.invalid','professional',true) id")).rows[0].id;
  const asOwner = (sql, args=[]) => db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
    await tx.exec('set local role authenticated'); return tx.query(sql,args);
  });
  const wid = (await asOwner("select public.create_workspace('Existing Upgrade Tenant',null,'equipe') result")).rows[0].result.workspace_id;
  // Existing user-owned settings and linked contact must not be rewritten by DDL.
  await db.query("update public.workspace_settings set city='Muriaé',state='MG' where workspace_id=$1",[wid]);
  const member=(await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2',[wid,uid])).rows[0].id;
  const service=(await db.query("insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Existing service',30,5000) returning id",[wid])).rows[0].id;
  await db.query('insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)',[wid,member,service]);
  await db.query("insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6) n",[wid,member]);
  const contact=(await db.query("insert into public.workspace_clients(workspace_id,full_name,email,phone) values($1,'Existing Client','existing@local.invalid','+5532999999999') returning id",[wid])).rows[0].id;
  const start=(await db.query("select ((current_date+3)+time '10:00') at time zone 'America/Sao_Paulo' s")).rows[0].s;
  await asOwner('select public.create_appointment($1,$2,$3,$4,$5,null)',[wid,contact,member,service,start]);
  const snapshot=async()=>({appointments:(await db.query('select * from public.appointments order by id')).rows,clients:(await db.query('select * from public.workspace_clients order by id')).rows,subscriptions:(await db.query('select * from public.subscriptions order by workspace_id')).rows,workspaces:(await db.query('select * from public.workspaces order by id')).rows});
  const before=await snapshot();
  await db.exec("create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key,name text,statements text[]); insert into supabase_migrations.schema_migrations(version,name) values('existing_fixture','preserve')");
  const bundle=readFileSync('docs/production-readiness/prelaunch20-apply-five.sql','utf8');
  await assert.rejects(db.transaction(tx=>tx.exec(bundle)),/explicit_project_authorization_required/);
  await db.transaction(async tx=>{await tx.query("select set_config('agende.authorized_project','wohimauqgywshbbejjcl',true)");await tx.exec(bundle);});
  assert.equal((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where version<>'existing_fixture'")).rows[0].n,5);
  await assert.rejects(db.transaction(async tx=>{await tx.query("select set_config('agende.authorized_project','wohimauqgywshbbejjcl',true)");await tx.exec(bundle);}),/prelaunch_history_present_or_drift/);
  assert.deepEqual(await snapshot(),before);
  // The apply bundle deliberately leaves creation paused until separately resumed.
  assert.equal((await db.query("select has_function_privilege('authenticated','public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text)','EXECUTE') allowed")).rows[0].allowed,false);
  await db.exec(readFileSync('docs/production-readiness/prelaunch20-resume-bookings.sql','utf8'));
  const gates=await db.exec(readFileSync('docs/production-readiness/prelaunch20-postchecks.sql','utf8'));
  assert.ok(gates[1].rows.length>=10); assert.ok(gates[1].rows.every(x=>x.passed), 'catalog postchecks must all pass');
  await db.exec(readFileSync('docs/production-readiness/prelaunch20-stop-bookings.sql','utf8'));
  const grants=async()=> (await db.query("select has_function_privilege('authenticated','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE') client,has_function_privilege('authenticated','public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text)','EXECUTE') team,has_function_privilege('anon','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE') anon")).rows[0];
  assert.deepEqual(await grants(),{client:false,team:false,anon:false});
  await db.exec(readFileSync('docs/production-readiness/prelaunch20-resume-bookings.sql','utf8'));
  assert.deepEqual(await grants(),{client:true,team:true,anon:false});
  assert.deepEqual(await snapshot(),before);
});
