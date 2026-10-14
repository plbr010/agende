// Creates real TEST Checkouts through the deployed Agende Edge Function.
// Does not pay, alter commercial prices, simulate webhooks or claim activation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
assert.equal(process.env.AGENDE_STAGING_BILLING_ACCEPTANCE,'TEST_ONLY');
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const client=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const checks=[],links=[],workspaces=[];
let token,failure;
const ok=async promise=>{const r=await promise;if(r.error)throw new Error('staging_api_failed');return r.data;};
const invoke=async body=>{
 const response=await fetch(config.url+'/functions/v1/stripe-billing',{method:'POST',headers:{apikey:config.publishable_key,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 const data=await response.json();
 if(response.status!==200)throw new Error(/^[a-z_]+$/.test(data.error)?data.error:'billing_failed');
 return data;
};
const save=()=>{
 mkdirSync('.test-postgres',{recursive:true});
 writeFileSync('.test-postgres/staging-billing-links.json',JSON.stringify({project:'fkpdudnnperufnmdwdlv',livemode:false,links},null,2)+'\n');
 writeFileSync('docs/staging/billing-application-acceptance.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',livemode:false,status:failure?'BLOCKED':'PARTIAL_ACCEPTANCE',checks,synthetic_workspace_ids:workspaces,error:failure,payment_completed:false,provider_webhook_delivery_verified:false,subscription_activation_verified:false,commercial_acceptance:false,production_connections:0,secrets_in_report:false},null,2)+'\n');
};
try{
 token=(await ok(client.auth.signInWithPassword({email:'owner-a@agende-staging.invalid',password:config.fixture_password}))).session.access_token;
 for(const plan of ['solo','equipe','salao'])for(const interval of ['monthly','annual']){
  const workspace=await ok(client.rpc('create_workspace',{p_name:'Billing TEST '+plan+' '+interval+' '+Date.now(),p_plan:plan}));
  workspaces.push(workspace.workspace_id);
  const body={workspaceId:workspace.workspace_id,action:'checkout',plan,billingInterval:interval,idempotencyKey:randomUUID()};
  const checkout=await invoke(body),url=new URL(checkout.url);
  assert.equal(url.hostname,'checkout.stripe.com');assert.equal(url.protocol,'https:');
  const sessionId=checkout.url.match(/cs_test_[A-Za-z0-9]+/)?.[0];assert.ok(sessionId,'Only TEST Checkout links accepted');
  const duplicate=await invoke(body);assert.equal(duplicate.url,checkout.url);
  const bound=await ok(client.from('subscriptions').select('external_customer_id,external_subscription_id,status,plan').eq('workspace_id',workspace.workspace_id).single());
  assert.ok(bound.external_customer_id);assert.equal(bound.external_subscription_id,null,'Checkout creation cannot activate access');
  const portal=await invoke({workspaceId:workspace.workspace_id,action:'portal'});
  assert.equal(new URL(portal.url).hostname,'billing.stripe.com');assert.equal(new URL(portal.url).protocol,'https:');
  links.push({workspace_id:workspace.workspace_id,plan,interval,session_id:sessionId,checkout_url:checkout.url,portal_url:portal.url});
  checks.push({plan,interval,session_id:sessionId,checkout_through_application:true,duplicate_reused:true,customer_bound:true,portal_created:true,status:'PASS',scope:'real TEST API; not payment/webhook acceptance'});
  save();console.log('PASS TEST Checkout and Portal '+plan+' '+interval);
 }
}catch(error){failure=/^[a-z_]+$/.test(error.message)?error.message:'billing_acceptance_failed';console.log('BLOCKED '+failure);process.exitCode=2;}finally{
 save();await client.auth.signOut({scope:'local'});
}
