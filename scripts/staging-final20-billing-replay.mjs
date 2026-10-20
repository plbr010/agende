// Actual provider TEST payloads, direct runner-signed duplicate delivery to staging. No provider mutations or live keys.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {existingStagingServerKey} from './staging-existing-server-key.mjs';
const project='fkpdudnnperufnmdwdlv';assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const c=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));assert.equal(c.url,`https://${project}.supabase.co`);
const links=JSON.parse(readFileSync('.test-postgres/staging-billing-links.json','utf8'));assert.equal(links.livemode,false);
const admin=createClient(c.url,existingStagingServerKey(),{auth:{persistSession:false,autoRefreshToken:false}});
const checks=[],invoiceMatches=[];let failure;
const ok=async p=>{const r=await p;assert.ok(!r.error,'staging_read_failed');return r.data;};
try{
 const key=await ok(admin.rpc('get_stripe_api_key'));assert.match(key,/^(sk|rk)_test_/);
 const get=async path=>{const r=await fetch('https://api.stripe.com/v1/'+path,{headers:{authorization:'Bearer '+key},signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,'test_provider_read_failed');return r.json();};
 const rows=await ok(admin.from('subscriptions').select('workspace_id,status,plan,billing_interval,external_subscription_id').in('workspace_id',links.links.map(x=>x.workspace_id)));
 const events=await ok(admin.from('billing_events').select('workspace_id,event_type').in('workspace_id',links.links.map(x=>x.workspace_id)));
 for(const item of links.links){
  assert.match(item.session_id,/^cs_test_/);const checkout=await get('checkout/sessions/'+item.session_id);assert.equal(checkout.livemode,false);assert.equal(checkout.payment_status,'paid');assert.equal(checkout.status,'complete');
  const sub=await get('subscriptions/'+checkout.subscription);assert.equal(sub.livemode,false);assert.equal(sub.status,'active');
  const invoice=await get('invoices/'+sub.latest_invoice);assert.equal(invoice.livemode,false);assert.equal(invoice.status,'paid');
  invoiceMatches.push({id:invoice.id,plan:item.plan,interval:item.interval});
  const bound=rows.find(x=>x.workspace_id===item.workspace_id);assert.equal(bound.external_subscription_id,sub.id);assert.equal(bound.status,'active');
  checks.push({plan:item.plan,interval:item.interval,provider_checkout_paid:true,provider_invoice_paid:true,provider_subscription_active:true,application_subscription_matches:true,cancel_at_period_end:sub.cancel_at_period_end,application_invoice_paid_event:events.some(x=>x.workspace_id===item.workspace_id&&x.event_type==='invoice.paid'),status:'PASS'});
 }
 const paidEvents=await get('events?type=invoice.paid&limit=100&created[gte]=1792512000');
 for(const invoice of invoiceMatches){const event=paidEvents.data.find(x=>x.data?.object?.id===invoice.id);checks.push({name:'provider invoice.paid delivery state',plan:invoice.plan,interval:invoice.interval,event_found:!!event,pending_webhooks:event?.pending_webhooks??null,status:event&&event.pending_webhooks===0?'PASS':'BLOCKED'});}
 const before=await ok(admin.from('subscriptions').select('workspace_id,external_subscription_id,plan,status,billing_interval,current_period_start,current_period_end,canceled_at').in('workspace_id',links.links.map(x=>x.workspace_id)).order('workspace_id'));
 const secret=await ok(admin.rpc('get_stripe_webhook_secret'));assert.match(secret,/^whsec_/);
 for(const invoice of invoiceMatches){
  const event=paidEvents.data.find(x=>x.data?.object?.id===invoice.id);assert.ok(event);assert.equal(event.livemode,false);
  const body=JSON.stringify(event);
  for(let n=0;n<2;n++){const timestamp=Math.floor(Date.now()/1000);const signature=createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');const response=await fetch(c.url+'/functions/v1/stripe-webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':`t=${timestamp},v1=${signature}`},body,signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,'actual_invoice_replay_failed');}
  const persisted=await ok(admin.from('billing_events').select('id').eq('provider','stripe').eq('external_event_id',event.id));assert.equal(persisted.length,1);
  checks.push({name:'real provider invoice payload, runner-signed direct duplicate replay',plan:invoice.plan,interval:invoice.interval,deliveries:2,persisted_rows:1,status:'PASS'});
 }
 const after=await ok(admin.from('subscriptions').select('workspace_id,external_subscription_id,plan,status,billing_interval,current_period_start,current_period_end,canceled_at').in('workspace_id',links.links.map(x=>x.workspace_id)).order('workspace_id'));assert.deepEqual(after,before);
 checks.push({name:'old invoice replay preserves current subscription status period and plan',status:'PASS'});
 const endpoints=await get('webhook_endpoints?limit=100');
 const own=endpoints.data.filter(x=>x.url===c.url+'/functions/v1/stripe-webhook');assert.ok(own.length,'staging_webhook_endpoint_missing');
 for(const endpoint of own){assert.equal(endpoint.livemode,false);checks.push({name:'provider staging endpoint configuration',status:endpoint.status==='enabled'?'PASS':'FAIL',enabled:endpoint.status==='enabled',all_events:endpoint.enabled_events.includes('*'),invoice_paid_enabled:endpoint.enabled_events.includes('*')||endpoint.enabled_events.includes('invoice.paid'),checkout_completed_enabled:endpoint.enabled_events.includes('*')||endpoint.enabled_events.includes('checkout.session.completed')});}
 console.log('PASS six actual TEST invoice duplicate replays; current staging subscriptions preserved');
}catch(error){failure=error.name;checks.push({name:'TEST provider audit',status:'FAIL',code:error.name});process.exitCode=1;}
finally{writeFileSync('docs/homologation/final20-stripe-direct-replay.json',JSON.stringify({checked_at:new Date().toISOString(),project,livemode:false,provider_mutations:0,direct_staging_webhook_posts:12,automatic_provider_retry_verified:false,production_writes:0,status:failure||checks.some(x=>x.status==='FAIL')?'FAIL':checks.some(x=>x.status==='BLOCKED')?'PARTIAL':'PASS',checks},null,2)+'\n');}
