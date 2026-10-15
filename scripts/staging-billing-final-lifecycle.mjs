// Real TEST Portal cancellation and declined hosted payment, with backend evidence.
import assert from 'node:assert/strict';import{readFileSync,writeFileSync,existsSync}from'node:fs';import{randomUUID}from'node:crypto';
import{chromium}from'playwright';import{createClient}from'@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const c=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));assert.equal(c.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const source=JSON.parse(readFileSync('.test-postgres/staging-billing-links.json','utf8'));assert.equal(source.livemode,false);
const a=createClient(c.url,c.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}}),checks=[];
const ok=async p=>{const r=await p;assert.equal(r.error,null);return r.data;};
let token,browser,page;
const invoke=async body=>{const r=await fetch(c.url+'/functions/v1/stripe-billing',{method:'POST',headers:{apikey:c.publishable_key,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();};
const pass=name=>{checks.push({name,status:'PASS'});console.log('PASS '+name);};
try {
 token=(await ok(a.auth.signInWithPassword({email:'owner-a@agende-staging.invalid',password:c.fixture_password}))).session.access_token;
 browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage({locale:'pt-BR'});page.setDefaultTimeout(30000);
 const portal=await invoke({workspaceId:source.links[1].workspace_id,action:'portal'});assert.equal(new URL(portal.url).hostname,'billing.stripe.com');await page.goto(portal.url);
 await page.getByText('Agendê Solo TEST',{exact:true}).first().waitFor();
 if(await page.getByText('Cancelar assinatura',{exact:true}).isVisible()){
  await page.getByText('Cancelar assinatura',{exact:true}).click();await page.getByRole('button',{name:/^Cancelar assinatura/}).click();
 }
 await page.getByText(/^Cancela em /).waitFor();pass('real hosted Customer Portal scheduled cancellation confirmed');
 const bound=await ok(a.from('subscriptions').select('status,external_subscription_id').eq('workspace_id',source.links[1].workspace_id).single());assert.equal(bound.status,'active');assert.ok(bound.external_subscription_id);pass('scheduled cancellation preserves paid period access');
 const privatePath='.env.final-decline.json';let workspace,checkout;
 if(existsSync(privatePath))({workspace,checkout}=JSON.parse(readFileSync(privatePath,'utf8')));
 else{workspace=await ok(a.rpc('create_workspace',{p_name:'Billing decline TEST '+Date.now(),p_plan:'solo'}));
 checkout=await invoke({workspaceId:workspace.workspace_id,action:'checkout',plan:'solo',billingInterval:'monthly',idempotencyKey:randomUUID()});writeFileSync(privatePath,JSON.stringify({workspace,checkout}));}
 assert.equal(new URL(checkout.url).hostname,'checkout.stripe.com');assert.match(checkout.url,/cs_test_/);await page.goto(checkout.url);
 await page.locator('#cardNumber').fill('4000000000000002');await page.locator('#cardExpiry').fill('1230');await page.locator('#cardCvc').fill('123');await page.locator('#billingName').fill('Pagamento recusado TEST');await page.getByRole('button',{name:'Assinar',exact:true}).click();
 await page.getByText(/cartão.*recusado|card was declined/i).first().waitFor();pass('real TEST provider declines designated test card');
 const declined=await ok(a.from('subscriptions').select('status,external_subscription_id').eq('workspace_id',workspace.workspace_id).single());assert.notEqual(declined.status,'active');assert.equal(declined.external_subscription_id,null);pass('declined checkout cannot grant an active subscription');
}catch(e){writeFileSync('.env.final-lifecycle-error.txt',String(e.stack));writeFileSync('.env.final-lifecycle-page.txt',await page?.locator('body').innerText().catch(()=>'' )??'');checks.push({name:'billing lifecycle',status:'FAIL',detail:'Private diagnostics withheld'});process.exitCode=1;}finally{
 writeFileSync('docs/staging/final-billing-lifecycle-20261015.json',JSON.stringify({checked_at:new Date().toISOString(),project:source.project,livemode:false,production_changed:false,checks},null,2)+'\n');await browser?.close();await a.auth.signOut({scope:'local'});
}
