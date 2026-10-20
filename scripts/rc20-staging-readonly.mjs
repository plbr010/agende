// Authenticates only owned staging fixtures. No business writes or Storage deletion.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
import {existingStagingServerKey} from './staging-existing-server-key.mjs';
const project='fkpdudnnperufnmdwdlv',origin='http://localhost:3000';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const cfg=read('.env.staging-homologation.json');assert.equal(cfg.url,`https://${project}.supabase.co`);
const fixtures=[read('.env.profiles-media-final20-fixtures.json').professional,read('.env.final20-employee-fixture.json'),read('.env.final20-booking-fixture.json')];
const checks=[],sessions=[];let browser,server;
const record=name=>{checks.push({name,status:'PASS'});console.log('PASS '+name);};
try {
 const socket=createServer();await new Promise((r,j)=>{socket.once('error',j);socket.listen(3000,'::1',r);});await new Promise(r=>socket.close(r));
 for(const credentials of fixtures){
  const jar=new Map(),client=createServerClient(cfg.url,cfg.publishable_key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(x=>jar.set(x.name,x.value))}});
  const {data,error}=await client.auth.signInWithPassword({email:credentials.email,password:credentials.password});assert.ok(!error,'owned staging login');assert.ok(data.user.email_confirmed_at);
  const verified=await client.auth.getUser();assert.ok(!verified.error);assert.equal(verified.data.user.id,data.user.id);sessions.push({client,jar,user:data.user});
 }
 record('three existing SMTP-confirmed owner professional and client identities verified by GoTrue');
 const guest=createClient(cfg.url,cfg.publishable_key,{auth:{persistSession:false}});
 const denied=await guest.rpc('create_public_appointment',{p_slug:'rc20-nonexistent',p_service_id:'00000000-0000-0000-0000-000000000000',p_professional_member_id:'00000000-0000-0000-0000-000000000000',p_starts_at:new Date().toISOString(),p_full_name:'Blocked probe',p_phone:'+5532999991234',p_email:null});assert.equal(denied.error?.code,'42501');
 record('anonymous booking RPC permission denied before any business write');
 const history=await sessions[2].client.rpc('list_my_appointments');assert.ok(!history.error);assert.ok(history.data.length>0);assert.ok(history.data.every(x=>x.status==='cancelled'));record('existing client reads own preserved cancelled booking history');
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','::1','--port','3000'],{windowsHide:true,stdio:'ignore',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:cfg.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:cfg.publishable_key,SUPABASE_SERVICE_ROLE_KEY:existingStagingServerKey(),SITE_URL:origin,NEXT_PUBLIC_SITE_URL:origin}});
 let ready=false;for(let n=0;n<80;n++){try{if((await fetch('http://[::1]:3000/api/account/avatar')).status===401){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready);
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP localhost [::1]']});
 for(const [i,path] of ['/app/equipe','/app/agenda','/cliente/agendamentos'].entries()){
  const context=await browser.newContext({viewport:{width:390,height:844}});await context.addCookies([...sessions[i].jar].map(([name,value])=>({name,value,url:origin,httpOnly:true,sameSite:'Lax'})));
  const page=await context.newPage();const response=await page.goto(origin+path);assert.equal(response.status(),200);assert.equal(new URL(page.url()).pathname,path);await page.locator('main').waitFor();assert.ok(await page.locator('main').innerText());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile overflow');await context.close();
 }
 record('current mobile owner team professional agenda and client history render with real staging sessions');
 const context=await browser.newContext();const page=await context.newPage();for(const city of ['Muriaé','Juiz de Fora']){const r=await page.goto(origin+'/descobrir?modo=city&uf=MG&cidade='+encodeURIComponent(city));assert.equal(r.status(),200);await page.locator('main').waitFor();}
 record('current public discovery pages render against real staging without publishing fixtures');
}catch(error){checks.push({name:'staging readonly acceptance',status:'FAIL',code:error.name});process.exitCode=1;}
finally{await browser?.close();server?.kill();for(const s of sessions)await s.client.auth.signOut({scope:'local'});writeFileSync('docs/production-readiness/rc20-staging-e2e.json',JSON.stringify({checked_at:new Date().toISOString(),project,application_base_sha:'9a8625ae2182e06716f47de3bc8da9051f898e3a',business_writes:0,production_writes:0,auth_operations:'owned fixture sign-in/getUser/local sign-out only',limits:'No fresh signup SMTP upload booking reschedule cancellation checkout or natural one-hour expiry in this run; prior FINAL20 evidence remains separately dated.',checks},null,2)+'\n');}
