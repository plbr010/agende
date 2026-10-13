// Explicit opt-in only: writes synthetic fixtures in the approved isolated project.
// Real GoTrue and PostgREST; confirmed accounts are SQL fixtures, not email acceptance.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv','Explicit staging opt-in required');
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const make=()=>createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=make(),other=make(),customer=make(),guest=make();
const roleClients=['admin','professional','receptionist'].map(role=>({role,client:make()}));
const checks=[];
const check=async(name,fn)=>{try{await fn();checks.push({name,status:'PASS',mode:'real staging API'});console.log('PASS '+name);}catch(error){checks.push({name,status:'FAIL',error:error.message});throw error;}};
const ok=async(request)=>{const r=await request;assert.equal(r.error,null,r.error?.message);return r.data;};
let workspace,foreignWorkspace,member,service,appointment,day,slots;
try{
 await check('GoTrue login and verified user for three synthetic fixtures',async()=>{
  for(const [client,email] of [[owner,'owner-a'],[other,'owner-b'],[customer,'client']]){
   const session=await ok(client.auth.signInWithPassword({email:email+'@agende-staging.invalid',password:config.fixture_password}));
   assert.ok(session.session);assert.ok((await ok(client.auth.getUser())).user.email_confirmed_at);
  }
 });
 await check('workspace creation and seven-day persisted trial',async()=>{
  for(const [client,name] of [[owner,'Staging Studio A'],[other,'Staging Studio B']]){
   const existing=await ok(client.from('workspaces').select('id,slug').eq('name',name));
   if(!existing.length)await ok(client.rpc('create_workspace',{p_name:name,p_plan:'equipe'}));
  }
  workspace=(await ok(owner.from('workspaces').select('id,slug').eq('name','Staging Studio A')))[0];
  foreignWorkspace=(await ok(other.from('workspaces').select('id,slug').eq('name','Staging Studio B')))[0];
  const trial=(await ok(owner.from('subscriptions').select('status,trial_started_at,trial_ends_at').eq('workspace_id',workspace.id)))[0];
  assert.equal(trial.status,'trialing');assert.equal(new Date(trial.trial_ends_at)-new Date(trial.trial_started_at),7*86400000);
 });
 await check('catalog and working hours persist through PostgREST',async()=>{
  const user=(await ok(owner.auth.getUser())).user;
  member=(await ok(owner.from('workspace_members').select('id').eq('workspace_id',workspace.id).eq('user_id',user.id)))[0].id;
  const existing=await ok(owner.from('services').select('id').eq('workspace_id',workspace.id).eq('name','Corte Staging'));
  if(!existing.length)await ok(owner.rpc('save_service_with_professionals',{p_workspace_id:workspace.id,p_service_id:null,p_name:'Corte Staging',p_description:null,p_duration_minutes:30,p_price_cents:5000,p_active:true,p_professional_member_ids:[member]}));
  service=(await ok(owner.from('services').select('id').eq('workspace_id',workspace.id).eq('name','Corte Staging')))[0].id;
  day=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  const weekday=new Date(day+'T12:00:00Z').getUTCDay();
  const hours=await ok(owner.from('professional_working_hours').select('id').eq('professional_member_id',member).eq('weekday',weekday));
  if(!hours.length)await ok(owner.from('professional_working_hours').insert({workspace_id:workspace.id,professional_member_id:member,weekday,start_time:'08:00',end_time:'18:00'}));
 });
 await check('real invitations enforce owner, admin, professional and receptionist scopes',async()=>{
  for(const {role,client} of roleClients){
   const user=(await ok(client.auth.signInWithPassword({email:role+'@agende-staging.invalid',password:config.fixture_password}))).user;
   const memberships=await ok(client.from('workspace_members').select('id').eq('workspace_id',workspace.id).eq('user_id',user.id));
   if(!memberships.length){
    const invite=await ok(owner.rpc('create_workspace_invite',{p_workspace_id:workspace.id,p_role:role,p_email:role+'@agende-staging.invalid'}));
    assert.ok(invite.token);await ok(client.rpc('accept_workspace_invite',{p_token:invite.token}));
   }
   const finance=await client.rpc('get_finance_ui',{p_workspace_id:workspace.id,p_start_date:day,p_end_date:day});
   if(role==='admin')assert.equal(finance.error,null,finance.error?.message);else {assert.ok(finance.error);assert.equal(finance.data,null);}
   assert.equal((await ok(client.from('services').select('id').eq('workspace_id',foreignWorkspace.id))).length,0);
   const memberRow=(await ok(client.from('workspace_members').select('id').eq('workspace_id',workspace.id).eq('user_id',user.id)))[0];
   const escalation=await client.from('workspace_members').update({role:'owner'}).eq('id',memberRow.id).select('role');
   assert.ok(escalation.error||!escalation.data?.some(x=>x.role==='owner'));
  }
 });
 await check('foreign salon cannot read services, finance or edit catalog',async()=>{
  assert.equal((await ok(other.from('services').select('id').eq('workspace_id',workspace.id))).length,0);
  assert.ok((await other.rpc('get_finance_ui',{p_workspace_id:workspace.id,p_start_date:day,p_end_date:day})).error);
  assert.ok((await other.rpc('save_service_with_professionals',{p_workspace_id:workspace.id,p_service_id:service,p_name:'IDOR',p_description:null,p_duration_minutes:30,p_price_cents:1,p_active:true,p_professional_member_ids:[member]})).error);
 });
 await check('public catalog and actual simultaneous booking: one winner',async()=>{
  const catalog=await ok(guest.rpc('list_public_booking_catalog',{p_slug:workspace.slug}));assert.ok(catalog);
  slots=(await ok(guest.rpc('list_public_available_slots',{p_slug:workspace.slug,p_service_id:service,p_professional_member_id:member,p_local_date:day}))).map(x=>x.starts_at);assert.ok(slots.length>3);
  const request={p_slug:workspace.slug,p_service_id:service,p_professional_member_id:member,p_starts_at:slots[0],p_full_name:'Cliente Sintetico',p_phone:'+5532999999999',p_email:'client@agende-staging.invalid',p_customer_note:null,p_ip_hash:'staging-only'};
  const results=await Promise.all([guest.rpc('create_public_appointment',request),make().rpc('create_public_appointment',request)]);
  assert.equal(results.filter(x=>!x.error).length,1);assert.equal(results.filter(x=>x.error).length,1);
  const rows=await ok(customer.rpc('list_my_appointments'));appointment=rows.find(x=>x.status==='scheduled'&&new Date(x.starts_at).getTime()===new Date(slots[0]).getTime())?.id;assert.ok(appointment);
 });
 await check('client IDOR denied; reschedule keeps ID and cancellation persists',async()=>{
  assert.ok((await other.rpc('cancel_my_appointment',{p_appointment_id:appointment})).error);
  const available=await ok(customer.rpc('list_my_reschedule_slots',{p_appointment_id:appointment,p_professional_member_id:member,p_local_date:day}));assert.ok(available.length);
  await ok(customer.rpc('reschedule_my_appointment',{p_appointment_id:appointment,p_professional_member_id:member,p_starts_at:available.at(-1).starts_at}));
  assert.ok((await ok(customer.rpc('list_my_appointments'))).some(x=>x.id===appointment));
  await ok(customer.rpc('cancel_my_appointment',{p_appointment_id:appointment}));
  assert.equal((await ok(owner.from('appointments').select('status').eq('id',appointment)))[0].status,'cancelled');
 });
 await check('completed appointment accepts one review under simultaneous submissions',async()=>{
  const free=await ok(guest.rpc('list_public_available_slots',{p_slug:workspace.slug,p_service_id:service,p_professional_member_id:member,p_local_date:day}));
  const start=free[1].starts_at;
  await ok(guest.rpc('create_public_appointment',{p_slug:workspace.slug,p_service_id:service,p_professional_member_id:member,p_starts_at:start,p_full_name:'Cliente Sintetico',p_phone:'+5532999999999',p_email:'client@agende-staging.invalid',p_customer_note:null,p_ip_hash:'staging-review-only'}));
  const id=(await ok(customer.rpc('list_my_appointments'))).find(x=>x.status==='scheduled'&&new Date(x.starts_at).getTime()===new Date(start).getTime()).id;
  for(const status of ['confirmed','in_progress','completed'])await ok(owner.rpc('set_appointment_status',{p_appointment_id:id,p_status:status}));
  const request={p_appointment_id:id,p_rating:5,p_comment:'Avaliacao sintetica de staging'};
  assert.ok((await other.rpc('submit_appointment_review',request)).error);
  const results=await Promise.all([customer.rpc('submit_appointment_review',request),customer.rpc('submit_appointment_review',request)]);
  assert.equal(results.filter(x=>!x.error).length,1);assert.equal(results.filter(x=>x.error).length,1);
  assert.equal((await ok(owner.from('appointment_reviews').select('id').eq('appointment_id',id))).length,1);
 });
 await check('local fictitious revenue, duplicate request and reports use real API',async()=>{
  const key=randomUUID(),request={p_workspace_id:workspace.id,p_entry_type:'income',p_description:'Receita ficticia staging',p_amount_cents:5000,p_due_date:day,p_idempotency_key:key};
  await ok(owner.rpc('create_financial_entry',request));await ok(owner.rpc('create_financial_entry',request));
  const entries=await ok(owner.from('financial_entries').select('id').eq('idempotency_key',key));assert.equal(entries.length,1);
  await ok(owner.rpc('mark_financial_entry_paid',{p_workspace_id:workspace.id,p_entry_id:entries[0].id,p_payment_method:'pix',p_paid_at:new Date().toISOString()}));
  assert.equal((await ok(owner.from('financial_entries').select('status').eq('id',entries[0].id)))[0].status,'paid');
  await ok(owner.rpc('get_workspace_report',{p_workspace_id:workspace.id,p_start_date:day,p_end_date:day}));
 });
 await check('refresh and logout revoke refresh session without logging tokens',async()=>{
  assert.ok((await ok(customer.auth.refreshSession())).session);
  const session=(await ok(customer.auth.getSession())).session;
  await ok(customer.auth.signOut());assert.equal((await ok(customer.auth.getSession())).session,null);
  assert.ok((await make().auth.refreshSession({refresh_token:session.refresh_token})).error);
 });
}finally{
 mkdirSync('docs/staging',{recursive:true});writeFileSync('docs/staging/real-api-results.json',JSON.stringify({checked_at:new Date().toISOString(),project:config.project,auth_accounts:'confirmed SQL fixtures; no signup/email-delivery acceptance',checks,passed:checks.every(x=>x.status==='PASS'),workspace_ids:[workspace?.id,foreignWorkspace?.id],secrets_in_report:false},null,2)+'\n');
 for(const client of [owner,other,customer,...roleClients.map(x=>x.client)])await client.auth.signOut();
}
