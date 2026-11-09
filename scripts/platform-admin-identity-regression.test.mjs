import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createLocalDatabase} from './local-database.mjs';

test('admin identity upgrade preserves existing grants, lifetime, benefits and RLS; existing tokens lose authority',async t=>{
 const db=await createLocalDatabase({throughVersion:'20261105152257'});t.after(()=>db.close());
 await db.exec(readFileSync('supabase/tests/helpers.sql','utf8'));
 const uid=(await db.query("select test_helpers.create_auth_user('plbrpc@gmail.com','professional',true) id")).rows[0].id;
 const other=(await db.query("select test_helpers.create_auth_user('other@synthetic.invalid','client',true) id")).rows[0].id;
 const as=(id,sql,args=[])=>db.transaction(async tx=>{
  await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.email','plbrpc@gmail.com',true)",[id]);
  await tx.exec('set local role authenticated');return tx.query(sql,args);
 });
 const w=(await as(uid,"select public.create_workspace('Lifetime preserved',null,'solo') d")).rows[0].d.workspace_id;
 await db.query('insert into app.platform_admins(user_id,granted_by) values($1,$1)',[uid]);
 await db.query("insert into app.lifetime_entitlements(workspace_id,granted_to,note) values($1,$2,'Existing benefit')",[w,uid]);
 const snapshot=async()=> (await db.query(`select jsonb_build_object(
  'roles',(select jsonb_agg(to_jsonb(a)) from app.platform_admins a),
  'lifetime',(select jsonb_agg(to_jsonb(l)) from app.lifetime_entitlements l),
  'courtesy',(select jsonb_agg(to_jsonb(c)) from app.complimentary_entitlements c),
  'entitlement_function',pg_get_functiondef('app.workspace_has_entitlement(uuid)'::regprocedure),
  'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in ('app','public','storage')),
  'subscriptions',(select jsonb_agg(to_jsonb(s)) from public.subscriptions s)) d`)).rows[0].d;
 const before=await snapshot();
 const migration=readFileSync('supabase/migrations/20261105152258_platform_admin_live_identity_guard.sql','utf8');
 await assert.rejects(db.transaction(async tx=>{await tx.exec(migration);throw Error('rollback_probe');}),/rollback_probe/);
 assert.deepEqual(await snapshot(),before);
 assert.equal((await db.query("select to_regprocedure('app.revoke_invalid_platform_admin_identity()') fn")).rows[0].fn,null);
 await db.exec(migration);
 assert.deepEqual(await snapshot(),before);
 assert.equal((await as(uid,'select public.is_platform_admin() ok')).rows[0].ok,true);
 assert.equal((await db.query('select app.workspace_has_entitlement($1) ok',[w])).rows[0].ok,true);
 await t.test('direct unauthorized access and metadata cannot escalate',async()=>{
  await db.query(`update auth.users set raw_user_meta_data='{"role":"super_admin","email":"plbrpc@gmail.com"}' where id=$1`,[other]);
  assert.equal((await as(other,'select public.is_platform_admin() ok')).rows[0].ok,false);
  await assert.rejects(as(other,'select public.admin_dashboard_overview()'),/not_platform_admin/);
  await assert.rejects(as(other,'select public.claim_official_platform_admin()'),/not_official_platform_admin/);
  await assert.rejects(as(other,'insert into app.platform_admins(user_id) values($1)',[other]),/permission denied/);
 });
 await t.test('email change invalidates the same token and durably revokes the grant',async()=>{
  await db.query("update auth.users set email='changed@synthetic.invalid' where id=$1",[uid]);
  assert.equal((await as(uid,'select public.is_platform_admin() ok')).rows[0].ok,false);
  await assert.rejects(as(uid,'select public.admin_dashboard_overview()'),/not_platform_admin/);
  assert.ok((await db.query('select revoked_at from app.platform_admins where user_id=$1',[uid])).rows[0].revoked_at);
  assert.equal((await db.query("select count(*)::int n from app.platform_audit_events where action='admin.identity_invalidated'")).rows[0].n,1);
  await db.query("update auth.users set email='plbrpc@gmail.com' where id=$1",[uid]);
  assert.equal((await as(uid,'select public.is_platform_admin() ok')).rows[0].ok,false);
  await assert.rejects(as(uid,'select public.claim_official_platform_admin()'),/operator_approval_required/);
  assert.deepEqual((await snapshot()).lifetime,before.lifetime);
  assert.equal((await db.query('select app.workspace_has_entitlement($1) ok',[w])).rows[0].ok,true);
 });
 await t.test('explicit operator regrant is possible but existing session loses access on revocation or unconfirmation',async()=>{
  const grant=()=>db.transaction(async tx=>{await tx.exec("select set_config('request.jwt.claim.role','service_role',true);set local role service_role");await tx.query('select public.grant_platform_admin($1)',[uid]);});
  await grant();assert.equal((await as(uid,'select public.is_platform_admin() ok')).rows[0].ok,true);
  const roleBefore=(await db.query('select to_jsonb(a) d from app.platform_admins a where user_id=$1',[uid])).rows[0].d;
  await as(uid,'select public.claim_official_platform_admin()');
  assert.deepEqual((await db.query('select to_jsonb(a) d from app.platform_admins a where user_id=$1',[uid])).rows[0].d,roleBefore);
  await db.query('update app.platform_admins set revoked_at=now() where user_id=$1',[uid]);
  await assert.rejects(as(uid,'select public.admin_dashboard_overview()'),/not_platform_admin/);
  await assert.rejects(as(uid,'select public.claim_official_platform_admin()'),/operator_approval_required/);
  await grant();await db.query('update auth.users set email_confirmed_at=null where id=$1',[uid]);
  assert.equal((await as(uid,'select public.is_platform_admin() ok')).rows[0].ok,false);
  await assert.rejects(as(uid,'select public.admin_dashboard_overview()'),/email_not_confirmed/);
 });
});
