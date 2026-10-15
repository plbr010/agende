// Direct signed replay of actual Stripe TEST events, not provider resend acceptance.
import assert from 'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';import{createHmac}from'node:crypto';
import{createClient}from'@supabase/supabase-js';import{existingStagingServerKey}from'./staging-existing-server-key.mjs';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const links=JSON.parse(readFileSync('.test-postgres/staging-billing-links.json','utf8'));assert.equal(links.livemode,false);
const admin=createClient(config.url,existingStagingServerKey(),{auth:{persistSession:false,autoRefreshToken:false}});
const ok=async p=>{const r=await p;assert.equal(r.error,null);return r.data;};
const checks=[];
try {
 const secret=await ok(admin.rpc('get_stripe_webhook_secret'));assert.match(secret,/^whsec_/);
 const events=JSON.parse(readFileSync('.env.final-replay-events.json','utf8'));
 const fields='workspace_id,external_subscription_id,plan,status,billing_interval';
 const subscriptions=await ok(admin.from('subscriptions').select(fields).in('workspace_id',links.links.map(x=>x.workspace_id)).order('workspace_id'));
 const ids=new Set(subscriptions.map(x=>x.external_subscription_id));
 for(const event of events){
  assert.equal(event.livemode,false);assert.ok(['invoice.paid','checkout.session.completed'].includes(event.type));const object=event.data.object;
  if(event.type==='checkout.session.completed')assert.ok(links.links.some(x=>x.session_id===object.id));
  else assert.ok(ids.has(object.subscription??object.parent?.subscription_details?.subscription??object.subscription_details?.subscription));
  const body=JSON.stringify(event);
  for(let n=0;n<2;n++){const timestamp=Math.floor(Date.now()/1000),sig=createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');
   const response=await fetch(config.url+'/functions/v1/stripe-webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':`t=${timestamp},v1=${sig}`},body});assert.equal(response.status,200);}
  const rows=await ok(admin.from('billing_events').select('id').eq('provider','stripe').eq('external_event_id',event.id));assert.equal(rows.length,1);
  checks.push({event_id:event.id,type:event.type,deliveries:2,persisted_rows:1,status:'PASS'});
 }
 const after=await ok(admin.from('subscriptions').select(fields).in('workspace_id',links.links.map(x=>x.workspace_id)).order('workspace_id'));
 assert.deepEqual(after,subscriptions,'Old paid/checkout events must preserve the latest canceled/past_due state and plan');
 checks.push({name:'old paid events preserve current canceled/past_due states and current plan',status:'PASS'});
 console.log('PASS real TEST event signed direct replay and duplicate persistence: '+checks.length);
}catch{checks.push({name:'real event replay',status:'FAIL'});process.exitCode=1;}finally{
 writeFileSync('docs/staging/final-event-replay-20261015.json',JSON.stringify({checked_at:new Date().toISOString(),project:links.project,mode:'actual TEST provider events, direct runner-signed replay; not Stripe Dashboard resend',livemode:false,secrets_in_report:false,checks},null,2)+'\n');
}
