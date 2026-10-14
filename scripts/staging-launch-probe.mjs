// Real, non-mutating Auth/Edge probes. A configured key is not billing acceptance.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv','Staging opt-in required');
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const client=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const checks=[],blockers=[];
let failure;
const ok=async request=>{const result=await request;if(result.error)throw new Error('staging_api_failed');return result.data;};
const headers={apikey:config.publishable_key,'content-type':'application/json'};
const invoke=(fn,body,token)=>fetch(config.url+'/functions/v1/'+fn,{method:'POST',headers:{...headers,...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
try{
  const settingsResponse=await fetch(config.url+'/auth/v1/settings',{headers,signal:AbortSignal.timeout(20000)});
  assert.equal(settingsResponse.status,200);
  const settings=await settingsResponse.json();
  assert.equal(settings.mailer_autoconfirm,false,'Email confirmation must stay mandatory');
  checks.push({name:'GoTrue settings require email confirmation',status:'PASS',mode:'real HTTP'});
  assert.equal((await invoke('stripe-billing',{})).status,401);
  assert.equal((await invoke('stripe-billing',{},'invalid-synthetic-token')).status,401);
  checks.push({name:'billing rejects anonymous and invalid sessions',status:'PASS',mode:'real deployed Edge'});
  const unsigned=await invoke('stripe-webhook',{id:'synthetic_no_signature'});
  assert.equal(unsigned.status,400);
  assert.equal((await unsigned.json()).error,'stripe_signature_missing');
  checks.push({name:'webhook rejects unsigned input',status:'PASS',mode:'real deployed Edge'});
  const login=await ok(client.auth.signInWithPassword({email:'owner-a@agende-staging.invalid',password:config.fixture_password}));
  assert.ok((await ok(client.auth.getUser())).user.email_confirmed_at);
  const workspace=(await ok(client.from('workspaces').select('id').eq('name','Staging Studio A')))[0];
  // Invalid action exercises key retrieval, without Customer/Checkout/Portal writes.
  const billing=await invoke('stripe-billing',{workspaceId:workspace.id,action:'readiness-invalid-action'},login.session.access_token);
  const response=await billing.json();
  if(billing.status===503&&response.error==='stripe_api_key_missing')blockers.push('stripe_api_key_missing');
  else if(billing.status===400&&response.error==='billing_action_invalid')checks.push({name:'billing key prerequisite accepted; no Stripe API operation performed',status:'PASS',mode:'real deployed Edge'});
  else throw new Error('billing_prerequisite_unexpected_response');
  checks.push({name:'real confirmed fixture login',status:'PASS',mode:'GoTrue; not signup/email delivery'});
}catch{failure='prerequisite_probe_failed';}finally{
  await client.auth.signOut();
  writeFileSync('docs/staging/launch-prerequisites.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',checks,blockers,status:failure?'FAIL':blockers.length?'BLOCKED':'PREREQUISITES_PASS',error:failure,commercial_acceptance:false,production_connections:0,secrets_in_report:false},null,2)+'\n');
}
console.log(JSON.stringify({checks,blockers,status:failure?'FAIL':blockers.length?'BLOCKED':'PREREQUISITES_PASS'}));
if(failure)process.exitCode=1;
