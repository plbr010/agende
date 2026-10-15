import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const cfg=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(cfg.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const fixtures=JSON.parse(readFileSync('.env.profiles-media-fixtures.json','utf8'));
const ok=async p=>{const r=await p;assert.equal(r.error,null,r.error?.code);return r.data;};
const pro=createClient(cfg.url,cfg.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}}),client=createClient(cfg.url,cfg.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const checks=[],record=name=>{checks.push({name,status:'PASS',mode:'real staging PostgREST RPCs; separate from browser evidence'});console.log('PASS '+name);};
let serviceId,appointmentId,hoursId,published=false;
try {
  await ok(pro.auth.signInWithPassword(fixtures.professional));await ok(client.auth.signInWithPassword(fixtures.client));
  const wid=fixtures.professional.workspaceId,slug=fixtures.professional.slug;
  const member=(await ok(pro.from('workspace_members').select('id').eq('workspace_id',wid).eq('user_id',fixtures.professional.id).single())).id;
  serviceId=await ok(pro.rpc('save_service_with_professionals',{p_workspace_id:wid,p_service_id:null,p_name:'Media booking fixture '+Date.now(),p_description:'Synthetic controlled acceptance',p_duration_minutes:30,p_price_cents:5000,p_active:true,p_professional_member_ids:[member]}));
  const day=new Date(Date.now()+3*86400000).toISOString().slice(0,10),weekday=new Date(day+'T12:00:00Z').getUTCDay();
  hoursId=(await ok(pro.from('professional_working_hours').insert({workspace_id:wid,professional_member_id:member,weekday,start_time:'08:00',end_time:'18:00'}).select('id').single())).id;
  await ok(pro.rpc('set_workspace_discovery',{p_workspace_id:wid,p_enabled:true}));published=true;
  const search=await ok(client.rpc('search_public_workspaces',{p_city:'Juiz de Fora',p_state:'MG',p_query:'Estúdio Media QA',p_limit:20}));assert.ok(search.items.some(x=>x.slug===slug));record('confirmed independent client finds published fixture by city');
  const slots=await ok(client.rpc('list_public_available_slots',{p_slug:slug,p_service_id:serviceId,p_professional_member_id:member,p_local_date:day}));assert.ok(slots.length);
  await ok(client.rpc('create_public_appointment',{p_slug:slug,p_service_id:serviceId,p_professional_member_id:member,p_starts_at:slots[0].starts_at,p_full_name:'Cliente Homologado',p_phone:'+5532999991234',p_email:fixtures.client.email,p_customer_note:'Controlled staging acceptance',p_ip_hash:'profiles-media-'+Date.now()}));
  appointmentId=(await ok(client.rpc('list_my_appointments'))).find(row=>row.service_id===serviceId)?.id;assert.ok(appointmentId);
  assert.equal((await ok(pro.from('appointments').select('id').eq('id',appointmentId).eq('workspace_id',wid))).length,1);record('client books real slot, sees own appointment and professional sees same id');
  assert.equal((await ok(pro.rpc('list_my_appointments'))).some(row=>row.id===appointmentId),false);record('professional account does not inherit client personal appointment history');
} finally {
  if(appointmentId)await ok(client.rpc('cancel_my_appointment',{p_appointment_id:appointmentId}));
  else if(serviceId){const rows=await ok(pro.from('appointments').select('id').eq('service_id',serviceId));for(const row of rows)await ok(pro.rpc('set_appointment_status',{p_appointment_id:row.id,p_status:'cancelled'}));}
  if(published)await ok(pro.rpc('set_workspace_discovery',{p_workspace_id:fixtures.professional.workspaceId,p_enabled:false}));
  if(serviceId)await ok(pro.from('services').update({active:false,archived_at:new Date().toISOString()}).eq('id',serviceId));
  if(hoursId)await ok(pro.from('professional_working_hours').delete().eq('id',hoursId));
  await pro.auth.signOut({scope:'local'});await client.auth.signOut({scope:'local'});
  writeFileSync('docs/staging/profiles-booking-real-20261015.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',passed:checks.length===3,checks,cleanup:{booking_cancelled:Boolean(appointmentId),service_archived:Boolean(serviceId),fixture_unpublished:published}},null,2)+'\n');
}
