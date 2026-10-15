// Add Stripe's off-session decline TEST card through the hosted Portal.
import assert from 'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';import{chromium}from'playwright';import{createClient}from'@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const c=JSON.parse(readFileSync('.env.staging-homologation.json'));assert.equal(c.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const d=JSON.parse(readFileSync('.test-postgres/staging-billing-links.json'));assert.equal(d.livemode,false);assert.match(d.links[2].session_id,/^cs_test_/);
const a=createClient(c.url,c.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}}),browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const l=await a.auth.signInWithPassword({email:'owner-a@agende-staging.invalid',password:c.fixture_password});assert.equal(l.error,null);
 const r=await fetch(c.url+'/functions/v1/stripe-billing',{method:'POST',headers:{apikey:c.publishable_key,authorization:'Bearer '+l.data.session.access_token,'content-type':'application/json'},body:JSON.stringify({workspaceId:d.links[2].workspace_id,action:'portal'})});assert.equal(r.status,200);const u=await r.json();assert.equal(new URL(u.url).hostname,'billing.stripe.com');
 const p=await browser.newPage({locale:'pt-BR'});await p.goto(u.url);await p.getByText('Adicionar forma de pagamento',{exact:true}).click();
 let frame;const until=Date.now()+30000;
 while(!frame&&Date.now()<until){for(const candidate of p.frames())if(await candidate.locator('input[name=number]').count()){frame=candidate;break;}if(!frame)await new Promise(r=>setTimeout(r,250));}
 assert.ok(frame,'Hosted payment input frame required');
 await frame.locator('input[name=number]').fill('4000000000000341');await frame.locator('input[name=expiry]').fill('1230');await frame.locator('input[name=cvc]').fill('123');
 await p.getByRole('button',{name:'Adicionar',exact:true}).click();await p.getByText(/0341/).first().waitFor();
 writeFileSync('docs/staging/final-renewal-card-20261015.json',JSON.stringify({checked_at:new Date().toISOString(),project:d.project,livemode:false,status:'PASS',scope:'hosted TEST Portal saves designated off-session decline card; renewal not yet executed'},null,2));console.log('PASS TEST off-session decline card added through Portal');
}catch(e){writeFileSync('.env.final-renewal-error.txt',String(e.stack));process.exitCode=1;}finally{await browser.close();await a.auth.signOut({scope:'local'});}
