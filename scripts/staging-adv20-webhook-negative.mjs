// Sends only invalid or wrong-environment requests to the staging webhook.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHmac,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {existingStagingServerKey} from './staging-existing-server-key.mjs';
const project='fkpdudnnperufnmdwdlv';assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const c=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));assert.equal(c.url,`https://${project}.supabase.co`);
const links=JSON.parse(readFileSync('.test-postgres/staging-billing-links.json','utf8'));assert.equal(links.livemode,false);
const admin=createClient(c.url,existingStagingServerKey(),{auth:{persistSession:false}}),checks=[];
const ok=async p=>{const r=await p;assert.ok(!r.error,'staging_read_failed');return r.data;};
try{
 const key=await ok(admin.rpc('get_stripe_api_key'));assert.match(key,/^(sk|rk)_test_/);
 const secret=await ok(admin.rpc('get_stripe_webhook_secret'));assert.match(secret,/^whsec_/);
 const read=()=>ok(admin.from('subscriptions').select('workspace_id,status,plan,billing_interval,external_subscription_id,current_period_end').in('workspace_id',links.links.map(x=>x.workspace_id)).order('workspace_id'));
 const before=await read(),eventId='evt_adv20_negative_'+randomUUID();
 for(const [name,body,validSignature]of [['invalid signature','{}',false],['invalid JSON','{',true],['signed LIVE event rejected by TEST backend',JSON.stringify({id:eventId,type:'customer.subscription.updated',livemode:true,data:{object:{id:'sub_invalid'}}}),true]]){
  const t=Math.floor(Date.now()/1000),sig=validSignature?createHmac('sha256',secret).update(t+'.'+body).digest('hex'):'0'.repeat(64);
  const r=await fetch(c.url+'/functions/v1/stripe-webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':`t=${t},v1=${sig}`},body,signal:AbortSignal.timeout(15000)});assert.equal(r.status,400);checks.push({name,status:'PASS',http:400});
 }
 assert.deepEqual(await read(),before);assert.equal((await ok(admin.from('billing_events').select('id').eq('external_event_id',eventId))).length,0);checks.push({name:'negative requests create no event and preserve all six owned TEST subscriptions',status:'PASS'});
}catch(e){checks.push({name:'staging webhook negative acceptance',status:'FAIL',code:e.name});process.exitCode=1;}
finally{writeFileSync('docs/homologation/adv20-webhook-negative.json',JSON.stringify({checked_at:new Date().toISOString(),project,production_writes:0,provider_mutations:0,checks},null,2)+'\n');}
