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
assert.ok(['signup','confirm','recovery'].includes(mode));
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
} else if(mode==='recovery') {
 const {error}=await client.auth.resetPasswordForEmail(state.email,{redirectTo:origin+'/auth/recovery'});save();
 record('recovery SMTP request',error?'FAIL':'PASS',error?error.code??'auth_request_failed':'GoTrue accepted; delivered link and password change not yet verified');
} else {
 const linkPath=`.env.stabilization-link-${intent}.txt`;
 assert.ok(existsSync(linkPath),'Actual received email link required');
 const link=new URL(readFileSync(linkPath,'utf8').trim());
 assert.equal(link.origin,config.url);assert.equal(link.pathname,'/auth/v1/verify');
 const target=await fetch(link,{redirect:'manual'});const location=target.headers.get('location');
 assert.ok(location);const callback=new URL(location);assert.equal(callback.origin,origin);
 assert.equal(callback.pathname,'/auth/callback');
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],
  {windowsHide:true,stdio:'ignore',env:{...process.env,SITE_URL:origin,NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key}});
 try {
  for(let n=0;n<60;n++){try{await fetch(origin+'/login');break;}catch{}await new Promise(r=>setTimeout(r,250));}
  const response=await fetch(callback,{redirect:'manual',headers:{cookie:[...jar].map(([n,v])=>`${n}=${v}`).join('; ')}});
  assert.equal(response.status,307);
  const destination=new URL(response.headers.get('location'));assert.equal(destination.origin,origin);
  assert.equal(destination.pathname,intent==='client'?'/p/staging-studio-a/agendar':'/onboarding');
  assert.ok(response.headers.getSetCookie().some(c=>c.startsWith(`sb-${project}-auth-token`)));
  record('actual delivered link establishes Next session and original destination','PASS');
  const reused=await fetch(link,{redirect:'manual'});const reuseTarget=new URL(reused.headers.get('location'));
  assert.ok(reuseTarget.searchParams.has('error')||reuseTarget.hash.includes('error'));
  record('actual signup link reuse denied','PASS');
 } finally {server.kill();}
}
