import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

test('salon read model: truthful statuses, paging, isolation and immutable upgrade', async t => {
 const db=await createLocalDatabase({throughVersion:'20261105194746'}); t.after(()=>db.close());
 await db.exec(readFileSync('supabase/tests/helpers.sql','utf8'));
 const as=(id,sql,args=[])=>db.transaction(async tx=>{
  await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[id]);
  await tx.exec('set local role authenticated');return tx.query(sql,args);
 });
 const admin=(await db.query("select test_helpers.create_auth_user('plbrpc@gmail.com','professional',true) id")).rows[0].id;
 await db.query('insert into app.platform_admins(user_id,granted_by) values($1,$1)',[admin]);
 const before=async()=> (await db.query("select jsonb_build_object('subscriptions',(select jsonb_agg(to_jsonb(s) order by id) from public.subscriptions s),'billing_events',(select jsonb_agg(to_jsonb(e) order by id) from public.billing_events e),'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p),'grants',(select jsonb_agg(to_jsonb(p) order by user_id) from app.platform_admins p),'lifetime',(select jsonb_agg(to_jsonb(l)) from app.lifetime_entitlements l)) d")).rows[0].d;
 const ids={}, owners={};
 const fixtures=[
  ['trial','trialing',null],['expired','trialing',null],['paid','active','active'],
  ['past_due','past_due','past_due'],['unpaid','past_due','unpaid'],
  ['incomplete','past_due','incomplete'],['canceled','canceled','canceled'],
  ['none',null,null],['unverified','active',null],['lifetime','active','active'],
 ];
 for(const [name,status,raw] of fixtures){
  const uid=(await db.query("select test_helpers.create_auth_user($1,'professional',true) id",[name+'@synthetic.invalid'])).rows[0].id;
  owners[name]=uid;
  const wid=(await as(uid,"select public.create_workspace($1,null,'solo') d",['Salão '+name])).rows[0].d.workspace_id;
  ids[name]=wid;
  await db.query('update public.profiles set full_name=$1 where user_id=$2',['Proprietário '+name,uid]);
  await db.transaction(async tx=>{
   await tx.exec("select set_config('app.bypass_protected_columns','on',true)");
   if(!status) { await tx.query('delete from public.subscriptions where workspace_id=$1',[wid]); return; }
   await tx.query("update public.subscriptions set status=$1::public.subscription_status,canceled_at=case when $1='canceled' then now() else null end,trial_started_at=now()-interval '2 days',trial_ends_at=now()+case when $2='expired' then interval '-1 day' else interval '5 days' end,current_period_start=now()-interval '1 day',current_period_end=now()+interval '29 days',billing_provider=case when $3::text is not null then 'stripe' else null end,external_subscription_id=case when $3::text is not null then $4 else null end where workspace_id=$5",[status,name,raw,'sub_'+name,wid]);
  });
  if(raw) await db.query("insert into public.billing_events(workspace_id,provider,external_event_id,event_type,event_status,occurred_at) values($1,'stripe',$2,'customer.subscription.updated',$3,now())",[wid,'evt_'+name,raw]);
  if(name==='paid'||name==='lifetime') await db.query("insert into public.billing_events(workspace_id,provider,external_event_id,event_type,event_status,amount_cents,occurred_at) values($1,'stripe',$2,'invoice.paid','paid',8990,now())",[wid,'invoice_'+name]);
  if(name==='lifetime') await db.query("insert into app.lifetime_entitlements(workspace_id,granted_to,note) values($1,$2,'Existing entitlement')",[wid,uid]);
 }
 const snapshot=await before();
 await db.exec(readFileSync('supabase/migrations/20261105194747_admin_salon_read_model.sql','utf8'));
 assert.deepEqual(await before(),snapshot);
 const load=async(query=null,status=null,limit=20,offset=0,wid=null)=>(await as(admin,'select public.admin_salon_overview($1,$2,$3,$4,$5) d',[query,status,limit,offset,wid])).rows[0].d;
 await t.test('all statuses and four global metrics use real fixture records',async()=>{
  const data=await load();
  const states=Object.fromEntries(data.items.map(r=>[r.name.replace('Salão ',''),r.status]));
  assert.deepEqual(states,{trial:'trial',expired:'trial_expired',paid:'paid',past_due:'past_due',unpaid:'unpaid',incomplete:'unverified',canceled:'canceled',none:'none',unverified:'unverified',lifetime:'unverified'});
  assert.deepEqual(data.counts,{total:10,trial:1,paid:1,delinquent:2,unverified:3});
  assert.equal(data.items.find(r=>r.id===ids.lifetime).lifetime,true);
 });
 await t.test('global metrics do not change with query/filter/page; name and owner search',async()=>{
  assert.equal((await load('Proprietário unpaid')).items[0].id,ids.unpaid);
  assert.equal((await load('salao paid')).items[0].id,ids.paid);
  const d=await load(null,'delinquent',1,1);assert.equal(d.items.length,1);assert.equal(d.total,2);assert.equal(d.counts.total,10);
  assert.equal((await load(null,'none')).items[0].id,ids.none);
  assert.equal((await load(null,'trial_expired')).items[0].id,ids.expired);
  assert.equal((await load('no-match')).total,0);
  assert.equal((await load(null,null,20,0,ids.paid)).items.length,1);
  await assert.rejects(load(null,'unrecognized'),/invalid_admin_filter/);
 });
 await t.test('anonymous, tenant owners, forged claims and revoked identity cannot use cross-tenant read',async()=>{
  await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');await tx.query('select public.admin_salon_overview()');}),/permission denied/);
  await assert.rejects(as(owners.trial,'select public.admin_salon_overview()'),/not_platform_admin/);
  await assert.rejects(as(admin,'select * from app.admin_salon_rows()'),/permission denied/);
  const scoped=await as(owners.trial,'select workspace_id from public.subscriptions');
  assert(scoped.rows.every(r=>r.workspace_id===ids.trial));
  await db.query("update auth.users set email='changed@synthetic.invalid' where id=$1",[admin]);
  await assert.rejects(load(),/not_platform_admin/);
 });
 await t.test('read-model rollback preserves rows, privileges and policies',async()=>{
  const state=await before();
  await db.exec('DROP FUNCTION public.admin_salon_overview(text,text,integer,integer,uuid); DROP FUNCTION app.admin_salon_rows();');
  assert.deepEqual(await before(),state);
 });
});
