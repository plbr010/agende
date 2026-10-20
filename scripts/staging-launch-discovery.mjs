// Real Auth/PostgREST/Next/browser acceptance on the explicit staging backend.
// No service-role key, schema changes, deployment, production access or messaging.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
const project='fkpdudnnperufnmdwdlv';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const config=JSON.parse(readFileSync(process.env.AGENDE_PHASE2_CONFIG_FILE??'.env.staging-homologation.json','utf8'));
assert.equal(config.url,`https://${project}.supabase.co`);
const launchFixture=JSON.parse(readFileSync('.env.profiles-media-fixtures.json','utf8'));
const clientFixture=process.env.AGENDE_CLIENT_FIXTURE_FILE?JSON.parse(readFileSync(process.env.AGENDE_CLIENT_FIXTURE_FILE,'utf8')).client:null;
if(clientFixture)assert.ok(clientFixture.email.includes('+agende-media-client-'),'owned_synthetic_client_required');
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key,VERCEL_ENV:'',SUPABASE_SERVICE_ROLE_KEY:''};
if(process.argv.includes('--build'))assert.equal(spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{env,stdio:'inherit',windowsHide:true}).status,0);
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...env,SITE_URL:origin,NEXT_PUBLIC_SITE_URL:origin},windowsHide:true,stdio:'ignore'});
const anon=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const login=async(prefix)=>{
 const jar=new Map();const client=createServerClient(config.url,config.publishable_key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
 const credentials=prefix.startsWith('owner') && prefix !== 'owner-b' ? {email:launchFixture.professional.email,password:launchFixture.professional.password} : prefix==='client'&&clientFixture?{email:clientFixture.email,password:clientFixture.password}:{email:prefix+'@agende-staging.invalid',password:config.fixture_password};
 const result=await client.auth.signInWithPassword(credentials);assert.ok(!result.error,'fixture_login_failed');
 return {client,user:result.data.user,password:credentials.password,jar,headers:()=>({cookie:[...jar].map(([name,value])=>`${name}=${value}`).join('; ')})};
};
const ok=async promise=>{const result=await promise;assert.ok(!result.error,'staging_operation_failed');return result.data;};

const checks=[];let browser;
try {
 for(let n=0;n<80;n++){try{if((await fetch(origin+'/api/account/avatar')).status===401)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 const owner=await login('owner-a'),customer=await login('client');
 const slug=launchFixture.professional.slug,wid=launchFixture.professional.workspaceId;
 const settings=await ok(owner.client.from('workspace_settings').select('city,state').eq('workspace_id',wid).single());
 const member=await ok(owner.client.from('workspace_members').select('id').eq('workspace_id',wid).eq('user_id',owner.user.id).single());
 const profile=await ok(owner.client.from('professional_profiles').select('display_name').eq('member_id',member.id).single());
 const padded=text=>'  '+text.toUpperCase().replaceAll(' ','   ')+'  ';
 const search=async(city,term)=>ok(anon.rpc('search_public_workspaces',{p_city:city,p_state:settings.state,p_query:term,p_limit:50}));
 for(const term of [null,'ESTUDIO MEDIA QA',padded(profile.display_name)]){
  const result=await search(padded(settings.city),term);assert.ok(result.items.some(x=>x.slug===slug),'fixture_missing');
  assert.ok(result.items.every(x=>Object.keys(x).every(k=>['name','slug','description','city','state','logo_path','booking_open'].includes(k))),'private_fields_exposed');
 }
 assert.ok(!(await search('Muriaé',profile.display_name)).items.some(x=>x.slug===slug),'city_filter_ignored');
 checks.push({name:'real public RPC handles city establishment professional combined accents case and extra spaces; only public contract',status:'PASS'});
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addCookies([...customer.jar].map(([name,value])=>({name,value,url:origin,httpOnly:true,sameSite:'Lax'})));
 const page=await context.newPage();page.setDefaultTimeout(30000);await page.goto(origin+'/cliente/descobrir');
 await page.locator('#discovery-city').fill(padded(settings.city));await page.locator('#discovery-state').selectOption(settings.state);await page.locator('#discovery-query').fill(padded(profile.display_name));
 await page.locator('form').filter({has:page.locator('#discovery-city')}).locator('button[type=submit]').click();
 await page.locator(`[aria-live="polite"] ul a[href="/p/${slug}"]`).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:'docs/homologation/launch-discovery-20261020.png',fullPage:true});
 checks.push({name:'actual mobile browser finds professional in a freely chosen city via Server Action',status:'PASS'});
}catch(error){writeFileSync('.env.launch-discovery-private-error.txt',String(error.stack));checks.push({name:'discovery staging acceptance',status:'FAIL',code:error.name});process.exitCode=1;}
finally{await browser?.close();server.kill();writeFileSync('docs/homologation/launch-discovery-20261020.json',JSON.stringify({checked_at:new Date().toISOString(),project,production_writes:0,checks},null,2)+'\n');console.log(JSON.stringify({checks}));}
