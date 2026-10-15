// Real signup -> delivered SMTP PKCE -> invitation. Never creates employee billing.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {createClient} from '@supabase/supabase-js';
import {existingStagingServerKey} from './staging-existing-server-key.mjs';
const project='fkpdudnnperufnmdwdlv',origin='http://localhost:3000';assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const cfg=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));assert.equal(cfg.url,`https://${project}.supabase.co`);
const prefix=process.env.AGENDE_PROFILES_FIXTURE_PREFIX;assert.match(prefix??'',/^[.]env[.]profiles-media-[a-z0-9-]+$/);
const ownerFixture=JSON.parse(readFileSync(prefix+'-fixtures.json','utf8')).professional;
const mailbox=process.env.AGENDE_STAGING_MAILBOX;assert.match(mailbox??'',/^[^@+\s]+@gmail[.]com$/);
const f={email:mailbox.replace('@',`+agende-employee-${Date.now()}@`),password:randomUUID()+'Aa2!'};
writeFileSync('.env.p0-employee-fixture.json',JSON.stringify(f));
const make=key=>createClient(cfg.url,key??cfg.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=make(),employee=make(),admin=make(existingStagingServerKey()),checks=[];
const ok=async p=>{const r=await p;assert.equal(r.error,null,r.error?.code);return r.data;};
let browser,server,invite,user,passed=false,cleaned=true;
const record=name=>{checks.push({name,status:'PASS'});console.log('PASS '+name);};
try {
 await ok(owner.auth.signInWithPassword({email:ownerFixture.email,password:ownerFixture.password}));
 await ok(owner.rpc('change_trial_plan',{p_workspace_id:ownerFixture.workspaceId,p_plan:'equipe'}));
 invite=await ok(owner.rpc('create_workspace_invite',{p_workspace_id:ownerFixture.workspaceId,p_role:'professional',p_email:f.email}));
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','::1','--port','3000'],{windowsHide:true,stdio:'ignore',env:{...process.env,SITE_URL:origin,NEXT_PUBLIC_SUPABASE_URL:cfg.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:cfg.publishable_key}});
 for(let n=0;n<80;n++){try{if((await fetch('http://[::1]:3000/login')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP localhost [::1]']});const page=await browser.newPage();page.setDefaultTimeout(30000);
 await page.goto(origin+'/convite/'+invite.token);await page.getByRole('link',{name:'Criar conta',exact:true}).click();
 for(const [name,value] of Object.entries({fullName:'Funcionária QA P0',email:f.email,phone:'32999998888',password:f.password,confirmPassword:f.password}))await page.locator(`input[name=${name}]`).fill(value);
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:/^Criar (minha conta|conta profissional)$/}).click();await page.waitForURL('**/verificar-email?status=sent');record('employee signs up from secure invitation, preserving return path');
 console.log('WAITING delivered employee confirmation');const path='.env.p0-employee-link.txt',until=Date.now()+15*60*1000;
 while(!existsSync(path)){assert.ok(Date.now()<until);await new Promise(r=>setTimeout(r,1000));}
 const link=new URL(readFileSync(path,'utf8').trim());assert.equal(link.origin,cfg.url);assert.equal(link.pathname,'/auth/v1/verify');assert.equal(new URL(link.searchParams.get('redirect_to')).origin,origin);
 await page.goto(link.href);await page.waitForURL('**/convite/*');await page.getByRole('button',{name:'Aceitar convite',exact:true}).click();await page.waitForURL('**/app');await page.reload();record('delivered email verifies PKCE and acceptance reaches professional dashboard');
 user=(await ok(employee.auth.signInWithPassword(f))).user.id;
 const members=await ok(employee.from('workspace_members').select('workspace_id,role').eq('user_id',user));assert.equal(members.length,1);assert.equal(members[0].workspace_id,ownerFixture.workspaceId);assert.equal(members[0].role,'professional');
 assert.equal((await ok(admin.from('workspaces').select('id').eq('owner_user_id',user))).length,0);assert.ok((await employee.rpc('get_finance_ui',{p_workspace_id:ownerFixture.workspaceId,p_start_date:'2026-10-15',p_end_date:'2026-10-15'})).error);record('employee has only invited role, no own workspace or individual subscription, finance denied');passed=true;
} finally {
 await browser?.close();server?.kill();
 try{if(!user)user=(await admin.auth.admin.listUsers({page:1,perPage:1000})).data.users.find(u=>u.email===f.email)?.id;if(invite)await ok(admin.from('workspace_invites').delete().eq('id',invite.invite_id));if(user)await ok(admin.auth.admin.deleteUser(user));await ok(owner.rpc('change_trial_plan',{p_workspace_id:ownerFixture.workspaceId,p_plan:'solo'}));}catch{cleaned=false;}
 await owner.auth.signOut({scope:'local'});await employee.auth.signOut({scope:'local'});
 writeFileSync('docs/staging/p0-employee-signup-20261015.json',JSON.stringify({checked_at:new Date().toISOString(),project,passed,cleanup:cleaned,production_writes:0,checks},null,2)+'\n');
}
assert.ok(passed&&cleaned);
