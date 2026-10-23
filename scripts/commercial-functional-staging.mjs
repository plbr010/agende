// Explicit staging only. Fresh owned fixtures; no production URL/key or SMTP mail.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {existingStagingServerKey} from './staging-existing-server-key.mjs';
const project='fkpdudnnperufnmdwdlv';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const cfg=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(cfg.url,`https://${project}.supabase.co`);
const make=key=>createClient(cfg.url,key??cfg.publishable_key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>{
  assert.equal(new URL(url).origin,cfg.url,'Only staging backend is allowed');
  return fetch(url,{...options,signal:AbortSignal.timeout(20000)});
}}});
const admin=make(existingStagingServerKey()),guest=make(),checks=[],fixtures=[];
let phase='start',failure;
const ok=async promise=>{const r=await promise;if(r.error){const error=new Error(r.error.message);error.code=r.error.code;throw error;}return r.data;};
const check=async(name,fn)=>{phase=name;await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);};
const identity=async(intent,confirm=true)=>{
  const email=`commercial-${randomUUID()}@agende-staging.invalid`,password=randomUUID()+'Aa2!';
  const generated=await ok(admin.auth.admin.generateLink({type:'signup',email,password,options:{data:{full_name:'Commercial QA',phone:'+5532999991234',intended_use:intent,terms_accepted:true,privacy_accepted:true}}}));
  const client=make();fixtures.push({user_id:generated.user.id});
  if(confirm){
    const verified=await ok(client.auth.verifyOtp({token_hash:generated.properties.hashed_token,type:'signup'}));
    assert.ok(verified.user.email_confirmed_at);
    await ok(client.auth.signOut({scope:'local'}));
    assert.ok((await ok(client.auth.signInWithPassword({email,password}))).session);
  }else{
    const r=await client.auth.signInWithPassword({email,password});assert.ok(r.error,'Unconfirmed login must fail');
  }
  return {client,id:generated.user.id};
};
let owner,foreign,customer,w,member,service,appointment,day,slots;
try{
  await check('GoTrue signup confirmation token, password login, unconfirmed login rejected',async()=>{
    owner=await identity('professional');foreign=await identity('professional');customer=await identity('client');await identity('client',false);
  });
  await check('fresh salon onboarding creates exactly seven days of trial',async()=>{
    const result=await ok(owner.client.rpc('create_workspace',{p_name:'Commercial QA '+Date.now(),p_plan:'equipe'}));
    w=await ok(owner.client.from('workspaces').select('id,slug,name').eq('id',result.workspace_id).single());
    fixtures.push({workspace_id:w.id});
    const trial=await ok(owner.client.from('subscriptions').select('status,trial_started_at,trial_ends_at').eq('workspace_id',w.id).single());
    assert.equal(trial.status,'trialing');assert.equal(new Date(trial.trial_ends_at)-new Date(trial.trial_started_at),7*86400000);
    await ok(foreign.client.rpc('create_workspace',{p_name:'Commercial foreign QA '+Date.now(),p_plan:'solo'}));
  });
  await check('professional profile, service assignment and working hours persist',async()=>{
    member=(await ok(owner.client.from('workspace_members').select('id').eq('workspace_id',w.id).eq('user_id',owner.id).single())).id;
    await ok(owner.client.from('professional_profiles').update({display_name:'Professional Commercial QA',booking_enabled:true}).eq('member_id',member));
    service=await ok(owner.client.rpc('save_service_with_professionals',{p_workspace_id:w.id,p_service_id:null,p_name:'Commercial QA Corte',p_description:null,p_duration_minutes:30,p_price_cents:5000,p_active:true,p_professional_member_ids:[member]}));
    day=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
    await ok(owner.client.from('professional_working_hours').insert({workspace_id:w.id,professional_member_id:member,weekday:new Date(day+'T12:00Z').getUTCDay(),start_time:'08:00',end_time:'18:00'}));
    const settings=await ok(owner.client.from('workspace_settings').select('*').eq('workspace_id',w.id).single());
    await ok(owner.client.rpc('update_workspace_settings',{p_workspace_id:w.id,p_name:w.name,p_slug:w.slug,p_business_phone:settings.business_phone,p_business_email:settings.business_email,p_description:settings.description,p_address:settings.address,p_city:'Muriaé',p_state:'MG',p_postal_code:settings.postal_code,p_instagram:settings.instagram,p_timezone:settings.timezone,p_logo_path:null,p_clear_logo:false}));
    await ok(owner.client.rpc('set_workspace_discovery',{p_workspace_id:w.id,p_enabled:true}));
  });
  await check('public city and salon search plus bookable professional catalog',async()=>{
    for(const args of [{p_city:'Muriaé'},{p_query:w.name}]){
      const result=await ok(guest.rpc('search_public_workspaces',{...args,p_limit:50}));assert.ok(result.items.some(x=>x.slug===w.slug));
    }
    const catalog=await ok(guest.rpc('list_public_booking_catalog',{p_slug:w.slug}));assert.ok(catalog.professionals.some(x=>x.id===member));
    slots=await ok(guest.rpc('list_public_available_slots',{p_slug:w.slug,p_service_id:service,p_professional_member_id:member,p_local_date:day}));assert.ok(slots.length>=2);
  });
  await check('only confirmed customer books; anonymous rejected; duplicate slot has one winner',async()=>{
    const request={p_slug:w.slug,p_service_id:service,p_professional_member_id:member,p_starts_at:slots[0].starts_at,p_full_name:'Commercial QA Client',p_phone:'+5532999991234',p_email:'forged@agende-staging.invalid',p_customer_note:null,p_ip_hash:'commercial-qa-'+randomUUID()};
    assert.ok((await guest.rpc('create_public_appointment',request)).error);
    const attempts=await Promise.all([customer.client.rpc('create_public_appointment',request),customer.client.rpc('create_public_appointment',request)]);
    assert.equal(attempts.filter(x=>!x.error).length,1);
    const history=await ok(customer.client.rpc('list_my_appointments'));appointment=history.find(x=>x.service_id===service);assert.ok(appointment);
    assert.equal((await ok(owner.client.from('appointments').select('id').eq('id',appointment.id))).length,1);
  });
  await check('salon isolation and foreign cancellation/reschedule rejected',async()=>{
    assert.equal((await ok(foreign.client.from('services').select('id').eq('workspace_id',w.id))).length,0);
    assert.equal((await ok(foreign.client.from('appointments').select('id').eq('id',appointment.id))).length,0);
    assert.ok((await foreign.client.rpc('cancel_my_appointment',{p_appointment_id:appointment.id})).error);
    assert.ok((await foreign.client.rpc('reschedule_my_appointment',{p_appointment_id:appointment.id,p_starts_at:slots[1].starts_at,p_professional_member_id:member})).error);
  });
  await check('customer reschedules same appointment then cancels and releases slot',async()=>{
    await ok(customer.client.rpc('reschedule_my_appointment',{p_appointment_id:appointment.id,p_starts_at:slots[1].starts_at,p_professional_member_id:member}));
    const moved=(await ok(customer.client.rpc('list_my_appointments'))).find(x=>x.id===appointment.id);assert.equal(Date.parse(moved.starts_at),Date.parse(slots[1].starts_at));
    await ok(customer.client.rpc('cancel_my_appointment',{p_appointment_id:appointment.id}));
    const canceled=(await ok(customer.client.rpc('list_my_appointments'))).find(x=>x.id===appointment.id);assert.equal(canceled.status,'cancelled');
    const available=await ok(guest.rpc('list_public_available_slots',{p_slug:w.slug,p_service_id:service,p_professional_member_id:member,p_local_date:day}));assert.ok(available.some(x=>Date.parse(x.starts_at)===Date.parse(slots[1].starts_at)));
  });
}catch(error){failure={phase,code:error.code??'assertion_or_transport_failure'};console.log('FAIL '+phase+' '+failure.code);process.exitCode=1;}
finally{
  writeFileSync('docs/homologation/commercial-functional-staging-20261023.json',JSON.stringify({checked_at:new Date().toISOString(),project,mode:'real staging GoTrue confirmation token + PostgREST; no SMTP or browser',production_connections:0,checks,failure,synthetic_fixtures_retained:true,fixtures,smtp_delivery_verified:false,stripe_checkout_executed:false},null,2)+'\n');
}
