// Real GoTrue SMTP/PKCE with explicitly authorized Gmail aliases. No admin confirmation.
// Sensitive state and incoming links stay in ignored .env files; reports contain no tokens.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createServerClient} from '@supabase/ssr';
import {spawn} from 'node:child_process';
const project='fkpdudnnperufnmdwdlv',origin='http://localhost:3000';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(config.url,`https://${project}.supabase.co`);
const [mode,intent]=process.argv.slice(2);
assert.ok(['signup','resend','confirm','recovery','recovery-confirm','expiry-confirm','negative'].includes(mode));
assert.ok(['client','professional'].includes(intent));
const statePath=`.env.stabilization-email-${intent}.json`;
const state=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):
 {email:`plbrpc+agende-stab-${intent==='client'?'cliente':'pro'}@gmail.com`,password:randomUUID()+'aA1!',cookies:[]};
const jar=new Map(state.cookies.map(c=>[c.name,c.value]));
const client=createServerClient(config.url,config.publishable_key,{cookies:{
 getAll:()=>[...jar].map(([name,value])=>({name,value})),
 setAll:values=>values.forEach(c=>jar.set(c.name,c.value)),
}});
const evidencePath='docs/staging/stabilization-email.json';
const report=existsSync(evidencePath)?JSON.parse(readFileSync(evidencePath,'utf8')):
 {project,mode:'real GoTrue SMTP request + SSR PKCE cookies + local Next callback; no UI acceptance claim',checks:[]};
const record=(name,status,detail)=>{report.checked_at=new Date().toISOString();report.checks.push({name,intent,status,detail});
 writeFileSync(evidencePath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({name,intent,status,detail}));};
const save=()=>{state.cookies=[...jar].map(([name,value])=>({name,value}));writeFileSync(statePath,JSON.stringify(state));};
if(mode==='signup') {
 assert.ok(!state.signupRequested,'Never resend or replace an existing test identity automatically');
 const {error}=await client.auth.signUp({email:state.email,password:state.password,options:{
  emailRedirectTo:`${origin}/auth/callback?next=${encodeURIComponent(intent==='client'?'/p/staging-studio-a/agendar':'/onboarding')}`,
  data:{full_name:'Stabilization SMTP Test',phone:intent==='client'?'32998765431':'32998765432',intended_use:intent,terms_accepted:true,privacy_accepted:true},
 }});
 state.signupRequested=!error;save();
 record('signup SMTP request',error?'FAIL':'PASS',error?error.code??'auth_request_failed':'GoTrue accepted; inbox delivery and callback still BLOCKED');
 record('inbox delivery and signup callback','BLOCKED','Await actual delivered email link from authorized mailbox');
} else if(mode==='resend') {
 assert.ok(state.signupRequested,'Existing authorized test signup required');
 const {error}=await client.auth.resend({type:'signup',email:state.email,options:{
  emailRedirectTo:`${origin}/auth/callback?next=${encodeURIComponent(intent==='client'?'/p/staging-studio-a/agendar':'/onboarding')}`,
 }});save();
 record('resend real signup confirmation',error?'FAIL':'PASS',error?error.code??'auth_request_failed':'GoTrue accepted; delivered link still required');
} else if(mode==='negative') {
 const login=await client.auth.signInWithPassword({email:state.email,password:state.password});
 if(login.data.user?.email_confirmed_at) {
  assert.equal(login.error,null);assert.ok(login.data.session);
  record('externally confirmed account can log in; original callback not verified','PASS');
  const logout=await client.auth.signOut({scope:'local'});assert.equal(logout.error,null);
  assert.equal((await client.auth.getSession()).data.session,null);save();
  record('real account logout clears SSR session cookies','PASS');
 } else {
  assert.equal(login.error?.code,'email_not_confirmed');assert.equal(login.data.session,null);
  record('real unconfirmed account cannot log in','PASS');
 }
 const invalid=await client.auth.verifyOtp({type:'signup',token_hash:randomUUID()});
 assert.ok(invalid.error);assert.equal(invalid.data.session,null);
 record('real invalid confirmation token cannot establish session','PASS');
} else if(mode==='recovery') {
 const {error}=await client.auth.resetPasswordForEmail(state.email,{redirectTo:origin+'/auth/recovery'});save();
 record('recovery SMTP request',error?'FAIL':'PASS',error?error.code??'auth_request_failed':'GoTrue accepted; delivered link and password change not yet verified');
} else {
 const expiring=mode==='expiry-confirm',recovering=mode==='recovery-confirm'||expiring;
 const linkPath=`.env.stabilization-${recovering?'recovery-link':'link'}-${intent}.txt`;
 assert.ok(existsSync(linkPath),'Actual received email link required');
 const link=new URL(readFileSync(linkPath,'utf8').trim());
 let callback;
 if(link.origin===origin) {callback=link;} else {
  assert.equal(link.origin,config.url);assert.equal(link.pathname,'/auth/v1/verify');
  const target=await fetch(link,{redirect:'manual'});const location=target.headers.get('location');
  assert.ok(location);callback=new URL(location);
 }
 assert.equal(callback.origin,origin);
 assert.equal(callback.pathname,recovering?'/auth/recovery':'/auth/callback');
 let elapsedSeconds;
 if(expiring) {
  assert.ok(callback.searchParams.get('code'),'A fresh actual PKCE code is required');
  const started=Date.now();console.log('WAITING 330 seconds for real PKCE code expiry; no clocks or auth settings changed');
  for(let n=0;n<11;n++)await new Promise(r=>setTimeout(r,30000));
  elapsedSeconds=Math.floor((Date.now()-started)/1000);
 }
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],
  {windowsHide:true,stdio:'ignore',env:{...process.env,SITE_URL:origin,NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key}});
 try {
  for(let n=0;n<60;n++){try{await fetch(origin+'/login');break;}catch{}await new Promise(r=>setTimeout(r,250));}
  const response=await fetch(callback,{redirect:'manual',headers:{cookie:[...jar].map(([n,v])=>`${n}=${v}`).join('; ')}});
  assert.equal(response.status,307);
  const destination=new URL(response.headers.get('location'));assert.equal(destination.origin,origin);
  if(expiring) {
   assert.ok(elapsedSeconds>=330);assert.equal(destination.pathname,'/recuperar-senha');
   assert.equal(destination.searchParams.get('status'),'expired');
   assert.ok(!response.headers.getSetCookie().some(c=>c.includes('auth-token=base64-')));
   record('actual unused PKCE recovery code expires by real elapsed time; callback rejects session','PASS',
    `elapsed_seconds=${elapsedSeconds}; clocks, timestamps and Auth settings unchanged`);
  } else {
  assert.equal(destination.pathname,recovering?'/redefinir-senha':intent==='client'?'/p/staging-studio-a/agendar':'/onboarding');
  assert.ok(response.headers.getSetCookie().some(c=>c.startsWith(`sb-${project}-auth-token`)));
  for(const cookie of response.headers.getSetCookie()) {
   const pair=cookie.split(';')[0],at=pair.indexOf('='),name=pair.slice(0,at),value=decodeURIComponent(pair.slice(at+1));
   if(value)jar.set(name,value);else jar.delete(name);
  }
  save();
  record(recovering?'actual delivered recovery link establishes Next reset session':'actual delivered link establishes Next session and original destination','PASS');
  if(recovering) {
   const recovery=createServerClient(config.url,config.publishable_key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
   const user=await recovery.auth.getUser();assert.equal(user.error,null);assert.equal(user.data.user.email,state.email);
   const previous=state.password,next=randomUUID()+'bB2!';
   const changed=await recovery.auth.updateUser({password:next});assert.equal(changed.error,null);state.password=next;
   assert.equal((await recovery.auth.signOut({scope:'local'})).error,null);
   assert.equal((await recovery.auth.signInWithPassword({email:state.email,password:previous})).error?.code,'invalid_credentials');
   assert.equal((await recovery.auth.signInWithPassword({email:state.email,password:next})).error,null);
   assert.equal((await recovery.auth.signOut({scope:'local'})).error,null);save();
   record('real staging fixture password recovery: new password works; old password denied; logout','PASS');
  }
  const reused=await fetch(link,{redirect:'manual'});const reuseTarget=new URL(reused.headers.get('location'));
  assert.ok(link.origin===origin?reuseTarget.pathname===(recovering?'/recuperar-senha':'/verificar-email'):reuseTarget.searchParams.has('error')||reuseTarget.hash.includes('error'));
  record(recovering?'actual recovery link reuse denied':link.origin===origin?'actual PKCE callback code reuse denied':'actual signup link reuse denied','PASS');
  }
 } finally {server.kill();}
}
