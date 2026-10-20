// Two real GoTrue clients race via PostgREST, never a mock Auth identity.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const project='fkpdudnnperufnmdwdlv';assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const cfg=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));assert.equal(cfg.url,`https://${project}.supabase.co`);
const fixtures=JSON.parse(readFileSync('.env.profiles-media-final20-fixtures.json','utf8')),booking=JSON.parse(readFileSync('.env.final20-booking-fixture.json','utf8'));
const make=()=>createClient(cfg.url,cfg.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}}),owner=make(),a=make(),b=make(),checks=[];
const ok=async p=>{const r=await p;assert.ok(!r.error,'staging_operation_failed');return r.data;};let service,hours,member;const created=[];
try{
 for(const [c,f]of [[owner,fixtures.professional],[a,fixtures.client],[b,booking]])await ok(c.auth.signInWithPassword({email:f.email,password:f.password}));
 const wid=fixtures.professional.workspaceId,slug=fixtures.professional.slug,uid=(await ok(owner.auth.getUser())).user.id;
 member=(await ok(owner.from('workspace_members').select('id').eq('workspace_id',wid).eq('user_id',uid).single())).id;
 service=await ok(owner.rpc('save_service_with_professionals',{p_workspace_id:wid,p_service_id:null,p_name:'Concurrent TEST '+Date.now(),p_description:null,p_duration_minutes:30,p_price_cents:5000,p_active:true,p_professional_member_ids:[member]}));
 const day=new Date(Date.now()+5*86400000).toISOString().slice(0,10),weekday=new Date(day+'T12:00Z').getUTCDay();
 hours=(await ok(owner.from('professional_working_hours').insert({workspace_id:wid,professional_member_id:member,weekday,start_time:'08:00',end_time:'18:00'}).select('id').single())).id;
 const slots=await ok(a.rpc('list_public_available_slots',{p_slug:slug,p_service_id:service,p_professional_member_id:member,p_local_date:day}));assert.ok(slots.length);
 const args={p_slug:slug,p_service_id:service,p_professional_member_id:member,p_starts_at:slots[0].starts_at,p_full_name:'Cliente Concorrência QA',p_customer_note:'Owned concurrent staging acceptance'};
 const results=await Promise.all([[a,fixtures.client,'+5532999992222'],[b,booking,'+5532999993333']].map(async([c,f,phone])=>({actor:c,result:await c.rpc('create_public_appointment',{...args,p_phone:phone,p_email:f.email})})));
 for(const x of results)if(x.result.data?.appointment_id)created.push({actor:x.actor,id:x.result.data.appointment_id});
 assert.equal(created.length,1);const rejected=results.find(x=>x.result.error);assert.ok(rejected);assert.ok(/slot_taken|23P01|overlap/i.test(rejected.result.error.message+' '+rejected.result.error.code));
 assert.equal((await ok(owner.from('appointments').select('id').eq('workspace_id',wid).eq('service_id',service))).length,1);
 checks.push({name:'two authenticated users concurrently reserve one real cloud slot; exactly one commits and the other receives slot conflict',status:'PASS',successful_reservations:1,rejected_reservations:1,rejection_code:rejected.result.error.code});
}catch(error){writeFileSync('.env.final20-concurrency-error.txt',String(error.stack));checks.push({name:'real staging concurrency',status:'FAIL',code:error.name});process.exitCode=1;}
finally{
 for(const x of created)await ok(x.actor.rpc('cancel_my_appointment',{p_appointment_id:x.id}));
 if(service)await ok(owner.from('services').update({active:false,archived_at:new Date().toISOString()}).eq('id',service).eq('workspace_id',fixtures.professional.workspaceId));
 if(hours)await ok(owner.from('professional_working_hours').delete().eq('id',hours).eq('professional_member_id',member));
 for(const c of [owner,a,b])await c.auth.signOut({scope:'local'});
 writeFileSync('docs/homologation/final20-real-concurrency.json',JSON.stringify({checked_at:new Date().toISOString(),project,mode:'real GoTrue + PostgREST + staging PostgreSQL',production_writes:0,existing_data_deleted:false,checks},null,2)+'\n');console.log(JSON.stringify({checks}));
}
