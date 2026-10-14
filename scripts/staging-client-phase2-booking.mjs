import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomInt} from 'node:crypto';
import {existingStagingServerKey} from './staging-existing-server-key.mjs';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const config=JSON.parse(readFileSync(process.env.AGENDE_PHASE2_CONFIG_FILE??'.env.staging-homologation.json','utf8'));
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const make=()=>createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const a=make(),b=make(),client=make(),checks=[],created=[];
const ok=async p=>{const r=await p;assert.equal(r.error,null,r.error?.message);return r.data;};
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS',mode:'real GoTrue/PostgREST'});console.log('PASS '+name);};
try {
 for(const [c,email] of [[a,'owner-a'],[b,'owner-b']])await ok(c.auth.signInWithPassword({email:email+'@agende-staging.invalid',password:config.fixture_password}));
 const admin=createClient(config.url,existingStagingServerKey(),{auth:{persistSession:false,autoRefreshToken:false}});
 const fixtureEmail=`phase2-${randomUUID()}@agende-staging.invalid`,fixturePassword=randomUUID()+'aA1!',fixturePhone='+55329'+randomInt(10000000,99999999);
 await ok(admin.auth.admin.createUser({email:fixtureEmail,password:fixturePassword,email_confirm:true,user_metadata:{full_name:'Phase2 Synthetic Client',phone:fixturePhone,intended_use:'client',terms_accepted:true,privacy_accepted:true}}));
 await ok(client.auth.signInWithPassword({email:fixtureEmail,password:fixturePassword}));
 const day=new Date(Date.now()+4*86400000).toISOString().slice(0,10),weekday=new Date(day+'T12:00Z').getUTCDay();
 const fixtures=[];
 await check('two independent salon catalogs and working hours through authenticated RPCs',async()=>{
  for(const [owner,name] of [[a,'Staging Studio A'],[b,'Staging Studio B']]) {
   const w=(await ok(owner.from('workspaces').select('id,slug,name').eq('name',name)))[0];assert.ok(w);
   const uid=(await ok(owner.auth.getUser())).user.id;
   const member=(await ok(owner.from('workspace_members').select('id').eq('workspace_id',w.id).eq('user_id',uid)))[0].id;
   const service=await ok(owner.rpc('save_service_with_professionals',{p_workspace_id:w.id,p_service_id:null,p_name:'Fase2 fixture '+Date.now(),p_description:'Synthetic staging acceptance',p_duration_minutes:30,p_price_cents:7310,p_active:true,p_professional_member_ids:[member]}));
   const hours=await ok(owner.from('professional_working_hours').select('id').eq('workspace_id',w.id).eq('professional_member_id',member).eq('weekday',weekday));
   if(!hours.length)await ok(owner.from('professional_working_hours').insert({workspace_id:w.id,professional_member_id:member,weekday,start_time:'08:00',end_time:'18:00'}));
   fixtures.push({owner,w,member,service});
  }
 });
 await check('real booking conflict and duplicate create has exactly one winner in each salon',async()=>{
  for(const f of fixtures){
   const slots=await ok(client.rpc('list_public_available_slots',{p_slug:f.w.slug,p_service_id:f.service,p_professional_member_id:f.member,p_local_date:day}));assert.ok(slots.length);
   const request={p_slug:f.w.slug,p_service_id:f.service,p_professional_member_id:f.member,p_starts_at:slots[0].starts_at,p_full_name:'Fase2 Synthetic Client',p_phone:fixturePhone,p_email:fixtureEmail,p_customer_note:'Synthetic phase2 test',p_ip_hash:'phase2-fixture-'+Date.now()};
   const results=await Promise.all([client.rpc('create_public_appointment',request),client.rpc('create_public_appointment',request)]);
   assert.equal(results.filter(r=>!r.error).length,1,JSON.stringify(results.map(r=>r.error?{code:r.error.code,message:r.error.message}:{success:true})));assert.equal(results.filter(r=>r.error).length,1);
   const rows=await ok(client.rpc('list_my_appointments'));const appointment=rows.find(x=>x.service_id===f.service);assert.ok(appointment);created.push({...f,id:appointment.id});
   assert.equal((await ok(b.rpc('list_my_appointments'))).some(x=>x.id===appointment.id),false,'forged email cannot give another session access');
  }
 });
 await check('history spans salons with stored price/status and no tenant cross-read',async()=>{
  for(const f of created){
   const rows=await ok(client.rpc('list_my_appointments'));const row=rows.find(x=>x.id===f.id);assert.equal(row.price_cents,7310);assert.equal(row.status,'scheduled');assert.equal(row.slug,f.w.slug);
   const outsider=f.owner===a?b:a;assert.equal((await ok(outsider.from('appointments').select('id').eq('id',f.id))).length,0);
   assert.ok((await outsider.rpc('submit_appointment_review',{p_appointment_id:f.id,p_rating:5,p_comment:'IDOR'})).error);
   assert.ok((await client.rpc('submit_appointment_review',{p_appointment_id:f.id,p_rating:5,p_comment:'premature'})).error);
  }
 });
 await check('completed visits accept one immutable validated review; duplicates and foreign authors denied',async()=>{
  for(const f of created){
   for(const status of ['confirmed','in_progress','completed'])await ok(f.owner.rpc('set_appointment_status',{p_appointment_id:f.id,p_status:status}));
   assert.ok((await client.rpc('submit_appointment_review',{p_appointment_id:f.id,p_rating:6,p_comment:'invalid'})).error);
   const input={p_appointment_id:f.id,p_rating:5,p_comment:'Synthetic phase2 review'};
   await ok(client.rpc('submit_appointment_review',input));assert.ok((await client.rpc('submit_appointment_review',input)).error);
   assert.ok((await client.from('appointment_reviews').update({rating:1}).eq('appointment_id',f.id)).error);
   assert.ok((await b.rpc('submit_appointment_review',input)).error);
  }
 });
}catch(e){checks.push({name:'booking/history/reviews acceptance',status:'FAIL',error:String(e.message).slice(0,400)});process.exitCode=1;console.log('FAIL booking/history/reviews acceptance');}
finally {writeFileSync('docs/staging/client-phase2-booking-history-reviews.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',production_touched:false,synthetic_fixtures_retained:true,checks},null,2)+'\n');}
