// Real mailbox-assisted Auth acceptance. Never reads the inbox or logs links/passwords.
// The owner clicks the emails and enters the recovery password directly in the UI.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer,request} from 'node:http';
import {createClient} from '@supabase/supabase-js';
import {createRequire} from 'node:module';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
assert.equal(process.env.AGENDE_STAGING_SMTP_READY,'1','Owner must confirm SMTP readiness');
assert.ok(process.env.AGENDE_AUTH_TEST_EMAIL,'Authorized mailbox required');
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const {chromium}=createRequire(import.meta.url)(process.env.AGENDE_PLAYWRIGHT_MODULE_PATH||'playwright');
const origin='http://localhost:3000',email=process.env.AGENDE_AUTH_TEST_EMAIL;
const password='Test!'+randomBytes(24).toString('base64url');
const client=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const checks=[],requests={signup:null,recovery:null};
let server,proxy,browser,failure,resetObserved=false,waitPhase='startup';
const receipt=()=>writeFileSync('docs/staging/auth-email-acceptance.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',checks,status:failure?'BLOCKED':waitPhase==='complete'?'PARTIAL_ACCEPTANCE':'WAITING_FOR_OWNER',waiting_for:waitPhase,error:failure,production_connections:0,secrets_in_report:false,mailbox_in_report:false,expired_by_elapsed_time_verified:false,new_password_login_verified:false,client_signup_email_verified:false,commercial_acceptance:false},null,2)+'\n');
const ok=async promise=>{const r=await promise;if(r.error)throw new Error(r.error.code||'auth_api_failed');return r.data;};
const wait=async predicate=>{
 const deadline=Date.now()+15*60000;let count=0;
 while(!predicate()){
  if(Date.now()>deadline)throw new Error('owner_action_timeout');
  await new Promise(resolve=>setTimeout(resolve,1000));
  if(++count%30===0)console.log('WAITING_FOR_OWNER '+waitPhase);
 }
};
try{
 const settings=await (await fetch(config.url+'/auth/v1/settings',{headers:{apikey:config.publishable_key}})).json();
 assert.equal(settings.mailer_autoconfirm,false);
 const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{windowsHide:true,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key,NEXT_PUBLIC_SITE_URL:origin},stdio:['ignore','pipe','pipe']});
 server.stderr.resume();
 // Never emit server diagnostics: they could contain an Auth link or form data.
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('local_server_timeout')),30000);let log='';server.stdout.on('data',c=>{log+=c;if(log.includes('Ready in')){clearTimeout(timer);resolve();}});server.once('error',()=>reject(new Error('local_server_failed')));});
 proxy=createServer((incoming,outgoing)=>{
  const url=new URL(incoming.url,origin);
  const phase=url.pathname==='/auth/confirm'&&url.searchParams.has('token_hash')?'signup':url.pathname==='/auth/recovery'&&url.searchParams.has('token_hash')?'recovery':null;
  const upstream=request({hostname:'127.0.0.1',port,path:incoming.url,method:incoming.method,headers:incoming.headers},response=>{
   const location=String(response.headers.location||'');
   if(phase&&response.statusCode===307&&!(location.includes('expired')||location.includes('status=error')))requests[phase]=url.href;
   if(incoming.method==='POST'&&url.pathname==='/redefinir-senha'&&String(response.headers['x-action-redirect']||location).includes('/login?password=updated'))resetObserved=true;
   outgoing.writeHead(response.statusCode,response.headers);response.pipe(outgoing);
  });
  upstream.on('error',()=>{outgoing.writeHead(502);outgoing.end('Staging unavailable');});incoming.pipe(upstream);
 });
 await new Promise((resolve,reject)=>{proxy.once('error',()=>reject(new Error('local_auth_port_3000_unavailable')));proxy.listen(3000,'127.0.0.1',resolve);});
 browser=await chromium.launch({headless:true,channel:process.env.AGENDE_BROWSER_CHANNEL||undefined});
 const invalid=await browser.newPage();await invalid.goto(origin+'/auth/confirm?token_hash=synthetic-invalid&type=email');assert.ok(invalid.url().includes('status=expired'));
 await invalid.goto(origin+'/auth/recovery?token_hash=synthetic-invalid&type=recovery');assert.ok(invalid.url().includes('status=expired'));
 checks.push({name:'invalid confirmation and recovery links rejected',mode:'real Next + GoTrue',status:'PASS',not_elapsed_expiry:true});
 const signup=await ok(client.auth.signUp({email,password,options:{emailRedirectTo:origin+'/auth/callback',data:{full_name:'Homologacao Staging',intended_use:'professional'}}}));
 assert.equal(signup.session,null,'Confirmation cannot be bypassed');
 if(signup.user?.identities?.length===0)throw new Error('existing_mailbox_account_requires_manual_flow');
 checks.push({name:'professional signup accepted without session',mode:'real GoTrue; SMTP receipt not yet proven',status:'PASS'});
 waitPhase='open_signup_email';receipt();console.log('ACTION: Open the staging signup email and click its confirmation button. Do not copy the link into chat.');
 await wait(()=>requests.signup!==null);
 const login=await ok(client.auth.signInWithPassword({email,password}));assert.ok(login.user.email_confirmed_at);
 checks.push({name:'owner opened confirmation email; verified GoTrue login',mode:'real mailbox + Next confirm + GoTrue',status:'PASS'});
 const replay=await browser.newPage();await replay.goto(requests.signup);assert.ok(replay.url().includes('status=expired'));
 checks.push({name:'used confirmation link rejected in a new browser session',mode:'real Next + GoTrue',status:'PASS'});
 const workspace=await ok(client.rpc('create_workspace',{p_name:'SMTP Homologacao '+Date.now(),p_plan:'solo'}));
 const wid=workspace.workspace_id;
 const trial=await ok(client.from('subscriptions').select('status,trial_started_at,trial_ends_at').eq('workspace_id',wid).single());
 assert.equal(trial.status,'trialing');assert.equal(new Date(trial.trial_ends_at)-new Date(trial.trial_started_at),7*86400000);
 checks.push({name:'confirmed signup creates workspace with one seven-day trial',mode:'real PostgREST',status:'PASS'});
 await ok(client.auth.resetPasswordForEmail(email,{redirectTo:origin+'/auth/recovery'}));
 waitPhase='open_recovery_email_and_set_test_password';receipt();console.log('ACTION: Open the staging recovery email, choose a unique test password directly in the form, then save.');
 await wait(()=>resetObserved);
 assert.ok((await client.auth.signInWithPassword({email,password})).error,'Previous password must stop working');
 await replay.goto(requests.recovery);assert.ok(replay.url().includes('status=expired'));
 checks.push({name:'owner reset password; old password and reused recovery link rejected',mode:'real mailbox + Next action + GoTrue',status:'PASS'});
 waitPhase='complete';receipt();console.log('PASS real Auth/email acceptance; elapsed expiry and new-password login still require separate owner evidence.');
}catch(error){
 failure=/^[a-z0-9_]+$/.test(error.message)?error.message:'auth_acceptance_failed';receipt();console.log('BLOCKED '+failure);process.exitCode=2;
}finally{
 await client.auth.signOut({scope:'local'}).catch(()=>{});await browser?.close();proxy?.close();server?.kill();
}
