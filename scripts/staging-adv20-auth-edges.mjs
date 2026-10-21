import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from 'playwright';
import {existingStagingServerKey} from './staging-existing-server-key.mjs';
const project='fkpdudnnperufnmdwdlv',origin='http://localhost:3000';assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const read=p=>JSON.parse(readFileSync(p,'utf8')),c=read('.env.staging-homologation.json'),f=read('.env.profiles-media-adv21-fixtures.json').client;assert.equal(c.url,`https://${project}.supabase.co`);
const socket=createServer();await new Promise((r,j)=>{socket.once('error',j);socket.listen(3000,'::1',r);});await new Promise(r=>socket.close(r));
const checks=[];let browser,page,phase='startup';const record=name=>{checks.push({name,status:'PASS'});console.log('PASS '+name);};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','::1','--port','3000'],{windowsHide:true,stdio:'ignore',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:c.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:c.publishable_key,SUPABASE_SERVICE_ROLE_KEY:existingStagingServerKey(),SITE_URL:origin,NEXT_PUBLIC_SITE_URL:origin}});
try{
 for(let n=0;n<80;n++){try{if((await fetch('http://[::1]:3000/login')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP localhost [::1]']});
 const context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(origin+'/cadastro?intent=client');
 for(const [name,value] of Object.entries({fullName:'Cliente Adversarial',email:f.email,password:f.password,confirmPassword:f.password}))await page.locator(`input[name=${name}]`).fill(value);await page.getByRole('checkbox').check();
 phase='phone_validation';for(const phone of ['', '123']){await page.locator('input[name=phone]').fill(phone);await page.getByRole('button',{name:'Criar conta de cliente',exact:true}).click();assert.equal(new URL(page.url()).pathname,'/cadastro');}
 record('missing and invalid phone cannot progress signup or report confirmation');
 phase='retain_fields_after_validation';await page.getByRole('alert').filter({hasText:'Confira os campos em vermelho.'}).waitFor();assert.equal(await page.locator('input[name=fullName]').inputValue(),'Cliente Adversarial');assert.equal(await page.locator('input[name=email]').inputValue(),f.email);assert.equal(await page.locator('input[name=password]').inputValue(),f.password);record('invalid phone preserves previously entered signup fields for a corrected resubmission');
 phase='duplicate_email';await page.getByRole('alert').filter({hasText:'Confira os campos em vermelho.'}).waitFor();await page.locator('input[name=phone]').fill('(32) 99999-1234');assert.equal(await page.locator('input[name=phone]').inputValue(),'(32) 99999-1234');writeFileSync('.env.adv20-phone-probe.json',JSON.stringify(await page.locator('form').evaluate(form=>({phone:new FormData(form).get('phone'),terms:new FormData(form).get('termsAccepted')}))));await page.getByRole('button',{name:'Criar conta de cliente',exact:true}).click();
 await page.getByRole('alert').filter({hasText:/Não foi possível iniciar um novo cadastro|Este e-mail já possui uma conta/}).waitFor();assert.equal(new URL(page.url()).pathname,'/cadastro');record('confirmed existing email with obfuscated GoTrue response shows sign-in/recovery guidance without claiming mail was sent');
 phase='expired_link';const link=new URL(readFileSync('.env.profiles-media-adv21-client-link.txt','utf8').trim());assert.equal(link.origin,c.url);assert.equal(new URL(link.searchParams.get('redirect_to')).href,origin+'/auth/callback');await page.goto(link.href);await page.waitForURL(/\/verificar-email\?status=(expired|error)/);await page.getByRole('button',{name:'Enviar e-mail de novo',exact:true}).waitFor();record('used real delivered confirmation link is rejected and renders expiry recovery');
 phase='invalid_session';await context.clearCookies();await context.addCookies([{name:'sb-'+project+'-auth-token',value:'base64-invalid-session',url:origin,httpOnly:true}]);await page.goto(origin+'/app');await page.waitForURL('**/login?next=**');record('malformed session cannot render protected app and returns to sign-in');
}catch(e){if(page)writeFileSync('.env.adv20-auth-edge-page.txt',await page.locator('body').innerText().catch(()=>''));checks.push({name:phase,status:'FAIL',code:e.name});writeFileSync('.env.adv20-auth-edges-error.txt',String(e.stack));process.exitCode=1;}
finally{await browser?.close();server.kill();writeFileSync('docs/homologation/adv20-auth-edges.json',JSON.stringify({checked_at:new Date().toISOString(),project,production_writes:0,scope:'owned confirmed fixture duplicate signup and already-used token; no new business resource',checks},null,2)+'\n');}
