// Explicitly authorized Auth-only acceptance. Never books, bills or deletes users.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID,randomInt} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
const project='wohimauqgywshbbejjcl',origin='https://agendeapp.online';
assert.equal(process.env.AGENDE_PRODUCTION_AUTH_ACCEPTANCE,project);
const config=JSON.parse(readFileSync('.env.production-auth-public.json','utf8'));assert.equal(config.url,`https://${project}.supabase.co`);
const file=process.env.AGENDE_PRODUCTION_AUTH_FIXTURE??'.env.production-auth-fixture.json',mailbox=JSON.parse(readFileSync('.env.final-mailbox.json','utf8')).mailbox;
assert.match(file,/^\.env\.production-auth-[a-z0-9-]+\.json$/);
assert.ok(!existsSync(file),'Never overwrite an existing or unfinished Auth fixture');
const run=Date.now(),fixture={email:mailbox.replace('@',`+agende-prod-auth-${run}@`),password:randomUUID()+'Aa2!',phone:'329'+randomInt(10000000,99999999)};
writeFileSync(file,JSON.stringify(fixture),{flag:'wx'});
const client=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}}),checks=[];
let browser,page,phase='startup';
const record=name=>{checks.push({name,status:'PASS'});console.log('PASS '+name);};
async function deliveredLink(type){
 const path=`.env.production-auth-${run}-${type}-link.txt`,until=Date.now()+15*60*1000;
 writeFileSync('.env.production-auth-mail-request.json',JSON.stringify({email:fixture.email,type,requested_at:Date.now(),link_output:path}));
 console.log('WAITING delivered '+type+' link');
 while(!existsSync(path)){assert.ok(Date.now()<until,'delivered_email_timeout');await new Promise(r=>setTimeout(r,1000));}
 const url=new URL(readFileSync(path,'utf8').trim());assert.equal(url.origin,config.url);assert.equal(url.pathname,'/auth/v1/verify');
 assert.equal(url.searchParams.get('type'),type==='signup'?'signup':'recovery');
 const destination=new URL(url.searchParams.get('redirect_to'));assert.equal(destination.origin,origin);assert.equal(destination.pathname,type==='signup'?'/auth/callback':'/auth/recovery');
 return url;
}
async function callback(link,path){
 const response=await fetch(link.href,{redirect:'manual'});assert.ok([302,303].includes(response.status),'verification_redirect_missing');
 const target=new URL(response.headers.get('location'));assert.equal(target.origin,origin);assert.equal(target.pathname,path);assert.ok(target.searchParams.has('code'),'verification_code_missing');
 await page.goto(target.href);
}
try{
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(30000);
 await page.goto(origin+'/cadastro?intent=client');
 for(const [name,value]of Object.entries({fullName:'Cliente QA Pré-lançamento',phone:fixture.phone,email:fixture.email,password:fixture.password,confirmPassword:fixture.password}))await page.locator(`input[name=${name}]`).fill(value);
 await page.getByRole('checkbox').check();phase='signup';await page.getByRole('button',{name:'Criar conta de cliente',exact:true}).click();await page.waitForURL('**/verificar-email?status=sent');
 assert.ok((await client.auth.signInWithPassword(fixture)).error);record('actual production signup requires confirmation and rejects password login before delivery');
 phase='signup_delivery';const signup=await deliveredLink('signup');await callback(signup,'/auth/callback');await page.waitForURL(origin+'/cliente/perfil?inicio=1');
 const confirmed=await client.auth.signInWithPassword(fixture);assert.ok(!confirmed.error);assert.ok(confirmed.data.user.email_confirmed_at);fixture.id=confirmed.data.user.id;writeFileSync(file,JSON.stringify(fixture));
 await page.reload();assert.equal(new URL(page.url()).pathname,'/cliente/perfil');record('delivered production SMTP confirmation completes original PKCE browser, onboarding profile and session survives reload');
 const used=await fetch(signup.href,{redirect:'manual'});assert.ok(/error/.test(used.headers.get('location')??''));record('used confirmation token cannot be reused');
 phase='recovery_request';await page.goto(origin+'/recuperar-senha');await page.locator('input[name=email]').fill(fixture.email);await page.getByRole('button',{name:'Enviar link de recuperação',exact:true}).click();await page.getByRole('status').waitFor();
 const recovery=await deliveredLink('recovery');phase='recovery';await callback(recovery,'/auth/recovery');await page.waitForURL('**/redefinir-senha');
 const previous=fixture.password,next=randomUUID()+'Aa2!';writeFileSync('.env.production-auth-pending-password.json',JSON.stringify({previous,next}));
 await page.locator('input[name=password]').fill(next);await page.locator('input[name=confirmPassword]').fill(next);await page.getByRole('button',{name:'Salvar nova senha',exact:true}).click();await page.waitForURL('**/login?password=updated');
 fixture.password=next;writeFileSync(file,JSON.stringify(fixture));assert.ok((await client.auth.signInWithPassword({email:fixture.email,password:previous})).error);record('production recovery delivered and old password rejected for newly created own QA fixture');
 phase='new_login';await page.locator('input[name=email]').fill(fixture.email);await page.locator('input[name=password]').fill(next);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('**/cliente');await page.reload();assert.equal(new URL(page.url()).pathname,'/cliente');
 await page.goto(origin+'/cliente/perfil');await page.getByRole('button',{name:'Sair da conta',exact:true}).click();await page.waitForURL(origin+'/');await page.goto(origin+'/cliente');await page.waitForURL('**/login?next=**');record('new password login persists; logout blocks protected client area');
}catch(error){writeFileSync('.env.production-auth-error.txt',String(error.stack));checks.push({name:phase,status:'FAIL',code:error.name});process.exitCode=1;}
finally{await browser?.close();await client.auth.signOut({scope:'local'});writeFileSync('docs/production-readiness/auth21-production-acceptance.json',JSON.stringify({checked_at:new Date().toISOString(),project,scope:'new owned QA customer; signup/confirmation/recovery/session only',production_auth_test_writes:true,existing_users_modified:false,users_deleted:0,bookings_created:0,financial_operations:0,checks},null,2)+'\n');}
