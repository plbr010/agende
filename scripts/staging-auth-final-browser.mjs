// Real form/SMTP/PKCE journey. Incoming links and credentials remain ignored.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {randomUUID,randomInt} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from 'playwright';
import {createClient} from '@supabase/supabase-js';
const project='fkpdudnnperufnmdwdlv',origin='http://localhost:3000';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(config.url,`https://${project}.supabase.co`);
function bundles(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?bundles(`${dir}/${e.name}`):e.name.endsWith('.js')?[`${dir}/${e.name}`]:[]);}
const files=bundles('.next/server').concat(bundles('.next/static'));
assert.ok(files.some(p=>readFileSync(p,'utf8').includes(config.url)),'Staging build required');
assert.ok(!files.some(p=>readFileSync(p,'utf8').includes('https://wohimauqgywshbbejjcl.supabase.co')),'Production build refused');
const settings=await fetch(config.url+'/auth/v1/settings',{headers:{apikey:config.publishable_key}});assert.ok(settings.ok);assert.equal((await settings.json()).mailer_autoconfirm,false);
// Refuse an occupied canonical callback port instead of silently using a proxy.
const socket=createServer();await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(3000,'::1',resolve);});await new Promise(resolve=>socket.close(resolve));
if(process.argv.includes('--check-only')){console.log('PASS staging build, real confirmation enabled and canonical port available');}else{
const mailbox=process.env.AGENDE_STAGING_MAILBOX;
assert.match(mailbox??'',/^[^@\s+]+@gmail\.com$/);
const [local,domain]=mailbox.split('@');
const resume=process.argv.includes('--resume-confirmed'),prefix='.env.final-auth-owned',reportPath='docs/staging/final-auth-owned-20261015.json';
assert.ok(resume||!existsSync(prefix+'-fixture.json'),'Do not replace an existing identity');
const fixture=resume?JSON.parse(readFileSync(prefix+'-fixture.json','utf8')):{email:`${local}+agende-final-${Date.now()}@${domain}`,password:randomUUID()+'aA1!',phone:'329'+randomInt(10000000,99999999)};
const save=()=>writeFileSync(prefix+'-fixture.json',JSON.stringify(fixture));save();
const checks=resume?JSON.parse(readFileSync(reportPath,'utf8')).checks:[],observations=[],report={project,mode:'owned Next server on IPv6 loopback, canonical localhost:3000, delivered SMTP, staging backend',checks,observations};
const record=(name,status='PASS')=>{checks.push({name,status});writeFileSync(reportPath,JSON.stringify({...report,checked_at:new Date().toISOString()},null,2)+'\n');console.log(status+' '+name);};
const waitLink=async kind=>{console.log('WAITING actual '+kind+' email link');const path=`${prefix}-${kind}-link.txt`,until=Date.now()+30*60*1000;
 while(!existsSync(path)){assert.ok(Date.now()<until,'Inbox link unavailable');await new Promise(r=>setTimeout(r,1000));}
 const url=new URL(readFileSync(path,'utf8').trim());assert.equal(url.origin,config.url);assert.equal(url.pathname,'/auth/v1/verify');return url.href;};
const server=spawn(process.execPath,['--import',new URL('./staging-auth-observer.mjs',import.meta.url).href,'node_modules/next/dist/bin/next','start','--hostname','::1','--port','3000'],{windowsHide:true,stdio:['ignore','ignore','ignore','ipc'],env:{...process.env,AGENDE_AUTH_OBSERVER:project,AGENDE_AUTH_TEST_EMAIL:fixture.email,SITE_URL:origin,NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key}});
server.on('message',message=>{if(message?.type==='agende-auth-evidence')observations.push(message.observation);});
let browser;
try {
 for(let n=0;n<60;n++){try{await fetch('http://[::1]:3000/login');break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP localhost [::1]']});const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(30000);
 const signup=resume?readFileSync(prefix+'-signup-link.txt','utf8').trim():null;
 if(!resume){await page.goto(origin+'/cadastro?intent=professional');await page.locator('#signup-intent-professional').click();
 for(const [name,value] of Object.entries({fullName:'Homologação profissional',email:fixture.email,phone:fixture.phone,password:fixture.password,confirmPassword:fixture.password}))await page.locator(`input[name=${name}]`).fill(value);
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Criar minha conta',exact:true}).click();await page.waitForURL('**/verificar-email?status=sent');assert.ok(observations.some(x=>x.path==='/cadastro'&&x.method==='POST'),'Owned server must observe actual signup');record('fresh professional signup through actual form on owned server');
 await page.goto(await waitLink('signup'));await page.waitForURL('**/onboarding');
 assert.ok(observations.some(x=>x.path==='/auth/callback'&&x.has_pkce_code&&x.has_pkce_verifier_cookie&&x.sets_session_cookie&&x.same_origin_redirect&&x.destination==='/onboarding'),'Owned callback must exchange PKCE and preserve origin');
 record('delivered signup email confirms in original PKCE browser');
 await page.getByRole('button',{name:'Sair',exact:true}).click();await page.waitForURL(origin+'/');}
 const login=async password=>{await page.goto(origin+'/login');await page.locator('input[name=email]').fill(fixture.email);await page.locator('input[name=password]').fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();};
 await login(fixture.password);await page.waitForURL('**/onboarding');record('explicit login after confirmation');
 await page.locator('input[name=name]').fill('Homologação final '+Date.now());await page.getByRole('button',{name:'Criar salão e começar teste grátis',exact:true}).click();await page.waitForURL('**/app?setup=1');await page.reload();assert.equal(new URL(page.url()).pathname,'/app');record('fresh onboarding trial dashboard and persisted browser session');
 const api=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
 const signed=await api.auth.signInWithPassword(fixture);assert.equal(signed.error,null);assert.ok(signed.data.user.email_confirmed_at);
 const memberships=await api.from('workspace_members').select('workspace_id,role').eq('user_id',signed.data.user.id);assert.equal(memberships.error,null);assert.equal(memberships.data.length,1);assert.equal(memberships.data[0].role,'owner');fixture.workspace_id=memberships.data[0].workspace_id;save();
 const subs=await api.from('subscriptions').select('status,trial_started_at,trial_ends_at').eq('workspace_id',fixture.workspace_id);assert.equal(subs.error,null);assert.equal(subs.data[0].status,'trialing');assert.equal(new Date(subs.data[0].trial_ends_at)-new Date(subs.data[0].trial_started_at),7*86400000);record('real persisted owner membership and seven-day trialing subscription');
 await page.getByRole('button',{name:'Sair',exact:true}).click();await page.waitForURL(origin+'/');record('dashboard logout');
 await page.goto(origin+'/recuperar-senha');await page.locator('input[name=email]').fill(fixture.email);await page.getByRole('button',{name:'Enviar link de recuperação',exact:true}).click();await page.getByRole('status').waitFor();record('recovery requested through actual form');
 const recovery=await waitLink('recovery');const response=await fetch(recovery,{redirect:'manual'});const callback=new URL(response.headers.get('location'));assert.equal(callback.origin,origin);assert.equal(callback.pathname,'/auth/recovery');assert.ok(callback.searchParams.has('code'));
 const other=await browser.newContext(),otherPage=await other.newPage();await otherPage.goto(callback.href);await otherPage.waitForURL('**/recuperar-senha?status=browser_mismatch');assert.ok(!(await other.cookies()).some(c=>c.name.includes('auth-token')));record('foreign browser without PKCE verifier rejected');await other.close();
 await page.goto(callback.href);await page.waitForURL('**/redefinir-senha');const previous=fixture.password,next=randomUUID()+'aA2!';
 await page.locator('input[name=password]').fill(next);await page.locator('input[name=confirmPassword]').fill(next);await page.getByRole('button',{name:'Salvar nova senha',exact:true}).click();await page.waitForURL('**/login?password=updated');fixture.password=next;save();record('delivered recovery link resets password in originating browser');
 await login(previous);await page.getByRole('alert').waitFor();assert.equal(new URL(page.url()).pathname,'/login');record('previous password rejected');
 await login(next);await page.waitForURL('**/app');await page.reload();assert.equal(new URL(page.url()).pathname,'/app');record('new password login and persisted session');
 await page.getByRole('button',{name:'Sair',exact:true}).click();await page.waitForURL(origin+'/');await page.goto(origin+'/app');await page.waitForURL('**/login?next=**');record('logout prevents dashboard access');
 for(const link of [signup??readFileSync(prefix+'-signup-link.txt','utf8').trim(),recovery]){const reused=await fetch(link,{redirect:'manual'});assert.ok(/error/.test(reused.headers.get('location')??''));}record('delivered signup and recovery links cannot be reused');
} catch(e) {writeFileSync('.env.final-auth-error.txt',String(e.stack));record('full browser journey (private diagnostics withheld)','FAIL');process.exitCode=1;} finally {await browser?.close();server.kill();}
}
