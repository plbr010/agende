// Fresh synthetic owner only; actual recovery SMTP/PKCE, no admin confirmation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
const project='fkpdudnnperufnmdwdlv',origin='http://localhost:3000';assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const cfg=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));assert.equal(cfg.url,`https://${project}.supabase.co`);
const fixtureFile='.env.profiles-media-final20-fixtures.json',fixtures=JSON.parse(readFileSync(fixtureFile,'utf8')),owner=fixtures.professional;
assert.ok(owner.email.includes('+agende-media-professional-'),'fresh_owned_owner_required');
const socket=createServer();await new Promise((r,j)=>{socket.once('error',j);socket.listen(3000,'::1',r);});await new Promise(r=>socket.close(r));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','::1','--port','3000'],{windowsHide:true,stdio:'ignore',env:{...process.env,SITE_URL:origin,NEXT_PUBLIC_SITE_URL:origin,NEXT_PUBLIC_SUPABASE_URL:cfg.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:cfg.publishable_key}});
const checks=[],client=createClient(cfg.url,cfg.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});let browser,page,phase='startup';
const record=name=>{checks.push({name,status:'PASS'});console.log('PASS '+name);};
try{
 for(let i=0;i<80;i++){try{if((await fetch('http://[::1]:3000/login')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP localhost [::1]']});const context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(30000);
 phase='request';writeFileSync('.env.final20-recovery-request.json',JSON.stringify({email:owner.email,requested_at:Date.now()}));
 await page.goto(origin+'/recuperar-senha');await page.locator('input[name=email]').fill(owner.email);await page.getByRole('button',{name:'Enviar link de recuperação',exact:true}).click();await page.getByRole('status').waitFor();record('recovery requested through actual form for own newly confirmed synthetic owner');
 console.log('WAITING actual delivered recovery email');const path='.env.final20-recovery-link.txt',until=Date.now()+15*60*1000;while(!existsSync(path)){assert.ok(Date.now()<until,'recovery_delivery_unavailable');await new Promise(r=>setTimeout(r,1000));}
 const link=new URL(readFileSync(path,'utf8').trim());assert.equal(link.origin,cfg.url);assert.equal(link.pathname,'/auth/v1/verify');assert.equal(link.searchParams.get('type'),'recovery');
 phase='foreign_browser';const response=await fetch(link.href,{redirect:'manual'}),callback=new URL(response.headers.get('location'));assert.equal(callback.origin,origin);assert.equal(callback.pathname,'/auth/recovery');assert.ok(callback.searchParams.has('code'));
 const foreign=await browser.newContext(),foreignPage=await foreign.newPage();await foreignPage.goto(callback.href);await foreignPage.waitForURL('**/recuperar-senha?status=browser_mismatch');assert.ok(!(await foreign.cookies()).some(c=>c.name.includes('auth-token')&&!c.name.includes('verifier')));await foreign.close();record('recovery callback without original PKCE verifier refuses a different browser');
 phase='reset';await page.goto(callback.href);await page.waitForURL('**/redefinir-senha');
 const previous=owner.password,next=randomUUID()+'Aa2!';writeFileSync('.env.final20-pending-owner-password.json',JSON.stringify({previous,next,fixtureFile}));
 await page.locator('input[name=password]').fill(next);await page.locator('input[name=confirmPassword]').fill(next);await page.getByRole('button',{name:'Salvar nova senha',exact:true}).click();await page.waitForURL('**/login?password=updated');
 owner.password=next;writeFileSync(fixtureFile,JSON.stringify(fixtures));assert.ok((await client.auth.signInWithPassword({email:owner.email,password:previous})).error);record('delivered recovery link changes password only in originating browser; old password rejected');
 phase='new_login';await page.locator('input[name=email]').fill(owner.email);await page.locator('input[name=password]').fill(next);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('**/app');await page.reload();assert.equal(new URL(page.url()).pathname,'/app');
 await page.getByRole('button',{name:'Sair',exact:true}).first().click();await page.waitForURL(origin+'/');await page.goto(origin+'/app');await page.waitForURL('**/login?next=**');record('new password login persists after reload; explicit logout prevents dashboard access');
 const reused=await fetch(link.href,{redirect:'manual'});assert.ok(/error/.test(reused.headers.get('location')??''));record('consumed delivered recovery link cannot be reused');
}catch(error){writeFileSync('.env.final20-recovery-error.txt',String(error.stack));checks.push({name:phase,status:'FAIL',code:error.name});process.exitCode=1;}
finally{await browser?.close();server.kill();await client.auth.signOut({scope:'local'});writeFileSync('docs/homologation/final20-recovery.json',JSON.stringify({checked_at:new Date().toISOString(),project,production_writes:0,administrative_confirmation:false,preexisting_before_task_user_passwords_changed:false,only_own_new_fixture_password_changed:true,checks},null,2)+'\n');}
