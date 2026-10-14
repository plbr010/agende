// Real authenticated staging API checks. Never reads the Stripe Vault secret.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const c=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(c.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const d=JSON.parse(readFileSync('.test-postgres/staging-billing-links.json','utf8'));
assert.equal(d.project,'fkpdudnnperufnmdwdlv');assert.equal(d.livemode,false);
const make=()=>createClient(c.url,c.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=make(),foreign=make(),checks=[];
const ok=async p=>{const r=await p;if(r.error)throw new Error('staging_request_failed');return r.data;};
try{
 await ok(owner.auth.signInWithPassword({email:'owner-a@agende-staging.invalid',password:c.fixture_password}));
 await ok(foreign.auth.signInWithPassword({email:'owner-b@agende-staging.invalid',password:c.fixture_password}));
 for(const x of d.links){
  const s=await ok(owner.from('subscriptions').select('plan,status,billing_interval,external_customer_id,external_subscription_id,current_period_end').eq('workspace_id',x.workspace_id).single());
  assert.ok(s.external_customer_id);assert.ok(s.external_subscription_id);
  if(x.plan!=='solo'||x.interval!=='monthly'){assert.equal(s.plan,x.plan);assert.equal(s.billing_interval,x.interval);}
  const hidden=await ok(foreign.from('subscriptions').select('workspace_id').eq('workspace_id',x.workspace_id));assert.equal(hidden.length,0);
  const finance=await foreign.rpc('get_finance_ui',{p_workspace_id:x.workspace_id,p_start_date:'2026-10-14',p_end_date:'2026-10-14'});assert.ok(finance.error);assert.equal(finance.data,null);
  const members=await ok(owner.from('workspace_members').select('id').eq('workspace_id',x.workspace_id).eq('role','owner').eq('status','active'));assert.equal(members.length,1);
  const existing=await ok(owner.from('services').select('id').eq('workspace_id',x.workspace_id).eq('name','Billing entitlement TEST'));
  const payload={p_workspace_id:x.workspace_id,p_service_id:existing[0]?.id??null,p_name:'Billing entitlement TEST',p_description:null,p_duration_minutes:15,p_price_cents:100,p_active:true,p_professional_member_ids:[members[0].id]};
  const mutation=await owner.rpc('save_service_with_professionals',payload);
  const active=s.status==='active';
  if(active){assert.equal(mutation.error,null);assert.ok(mutation.data);}else{assert.ok(mutation.error);assert.equal(mutation.data,null);}
  const idor=await foreign.rpc('save_service_with_professionals',payload);assert.ok(idor.error);assert.equal(idor.data,null);
  checks.push({workspace_id:x.workspace_id,original_plan:x.plan,original_interval:x.interval,current_plan:s.plan,current_interval:s.billing_interval,status:s.status,current_period_end:s.current_period_end,subscription_id:s.external_subscription_id,customer_bound:true,foreign_subscription_hidden:true,foreign_finance_denied:true,foreign_write_denied:true,manager_write_allowed:active,entitlement_enforced:true,result:'PASS'});
  console.log('PASS real billing entitlement and tenant isolation '+x.plan+' '+x.interval+' '+s.status);
 }
}finally{
 writeFileSync('docs/staging/billing-access-verification.json',JSON.stringify({checked_at:new Date().toISOString(),project:d.project,livemode:false,status:checks.length===d.links.length?'PASS':'FAIL',checks,production_changed:false,secrets_in_report:false},null,2)+'\n');
 await Promise.all([owner.auth.signOut({scope:'local'}),foreign.auth.signOut({scope:'local'})]);
}
