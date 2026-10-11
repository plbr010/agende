import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

const as=(db,uid,sql,args=[])=>db.transaction(async tx=>{
  if(uid)await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[uid]);
  await tx.exec(uid?'set local role authenticated':'set local role anon');return tx.query(sql,args);
});
async function fixture(db,label){
  const uid=(await db.query("select test_helpers.create_auth_user($1,'professional',true) id",[label.replace(/\s+/g,'-').toLowerCase()+'@atomic-local.invalid'])).rows[0].id;
  const wid=(await as(db,uid,"select public.create_workspace($1,null,'equipe') data",[label])).rows[0].data.workspace_id;
  const member=(await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2',[wid,uid])).rows[0].id;
  return{uid,wid,member};
}
const save=(db,user,workspace,id,members,name='Corte')=>as(db,user,
  'select public.save_service_with_professionals($1,$2,$3,null,30,5000,true,$4) id',[workspace,id,name,members]);

test('atomic catalog SQL protects tenant boundaries, roles and existing overrides',async t=>{
  const db=await createLocalDatabase();t.after(()=>db.close());await db.exec(readFileSync('supabase/tests/helpers.sql','utf8'));
  const owner=await fixture(db,'Owner Atomic'),foreign=await fixture(db,'Foreign Atomic');
  const created=(await save(db,owner.uid,owner.wid,null,[owner.member,owner.member])).rows[0].id;
  assert.equal((await db.query('select count(*)::int n from public.professional_services where service_id=$1',[created])).rows[0].n,1);
  await assert.rejects(save(db,owner.uid,owner.wid,null,[owner.member,foreign.member]),/professional_not_found/);
  await assert.rejects(save(db,owner.uid,owner.wid,created,[foreign.member],'Must not persist'),/professional_not_found/);
  assert.equal((await db.query('select name from public.services where id=$1',[created])).rows[0].name,'Corte');
  assert.equal((await db.query('select count(*)::int n from public.services where workspace_id=$1',[owner.wid])).rows[0].n,1);
  await assert.rejects(save(db,foreign.uid,owner.wid,created,[owner.member]),/not_authorized/);
  await assert.rejects(save(db,owner.uid,owner.wid,(await save(db,foreign.uid,foreign.wid,null,[foreign.member])).rows[0].id,[owner.member]),/service_not_found/);
  await assert.rejects(save(db,null,owner.wid,created,[owner.member]),/permission denied/);
  const professional=(await db.query("select test_helpers.create_auth_user('professional@atomic-local.invalid','professional',true) id")).rows[0].id;
  const receptionist=(await db.query("select test_helpers.create_auth_user('receptionist@atomic-local.invalid','professional',true) id")).rows[0].id;
  await db.query("insert into public.workspace_members(workspace_id,user_id,role,status) values($1,$2,'professional','active'),($1,$3,'receptionist','active')",[owner.wid,professional,receptionist]);
  for(const uid of [professional,receptionist])await assert.rejects(save(db,uid,owner.wid,created,[owner.member]),/not_authorized/);
  await as(db,owner.uid,'update public.professional_services set price_override_cents=6000,duration_override_minutes=45 where service_id=$1',[created]);
  assert.equal((await save(db,owner.uid,owner.wid,created,[owner.member],'Updated')).rows[0].id,created);
  const link=(await db.query('select price_override_cents,duration_override_minutes from public.professional_services where service_id=$1',[created])).rows[0];
  assert.deepEqual(link,{price_override_cents:6000,duration_override_minutes:45});
  const admin=(await db.query("select test_helpers.create_auth_user('admin@atomic-local.invalid','professional',true) id")).rows[0].id;
  await db.query("insert into public.workspace_members(workspace_id,user_id,role,status) values($1,$2,'admin','active')",[owner.wid,admin]);
  assert.equal((await save(db,admin,owner.wid,created,[owner.member],'Updated by admin')).rows[0].id,created);
  await assert.rejects(save(db,owner.uid,owner.wid,created,[]),/invalid_professionals/);
});

test('an error after service insertion rolls back the entire atomic RPC',async t=>{
  const db=await createLocalDatabase();t.after(()=>db.close());await db.exec(readFileSync('supabase/tests/helpers.sql','utf8'));
  const owner=await fixture(db,'Rollback Atomic');
  // Failure injection exists only in this in-memory test database.
  await db.exec("create function app.test_link_failure() returns trigger language plpgsql as $$ begin raise exception 'injected_link_failure'; end $$; create trigger test_link_failure before insert on public.professional_services for each row execute function app.test_link_failure()");
  await assert.rejects(save(db,owner.uid,owner.wid,null,[owner.member]),/injected_link_failure/);
  assert.equal((await db.query('select count(*)::int n from public.services where workspace_id=$1',[owner.wid])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from public.professional_services where workspace_id=$1',[owner.wid])).rows[0].n,0);
});
