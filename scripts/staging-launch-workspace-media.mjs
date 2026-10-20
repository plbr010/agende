// Explicit staging only. Existing synthetic accounts, own new photo bytes only.
// No production hosts, automatic messages, billing or Auth configuration changes.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { existingStagingServerKey } from './staging-existing-server-key.mjs';
const project='fkpdudnnperufnmdwdlv';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const config=JSON.parse(readFileSync(process.env.AGENDE_PHASE2_CONFIG_FILE??'.env.staging-homologation.json','utf8'));
assert.equal(config.url,`https://${project}.supabase.co`);
const launchFixture=JSON.parse(readFileSync('.env.profiles-media-fixtures.json','utf8'));
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key,VERCEL_ENV:''};
if(process.argv.includes('--build')) {
 const built=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{env,stdio:'inherit',windowsHide:true});
 assert.equal(built.status,0,'staging build required');
}
const key=existingStagingServerKey();
const bundles=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?bundles(`${dir}/${e.name}`):e.name.endsWith('.js')?[`${dir}/${e.name}`]:[]);
assert.ok(!bundles('.next/static').some(p=>readFileSync(p,'utf8').includes(key)),'server credential excluded from frontend');
const admin=createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...env,SITE_URL:origin,NEXT_PUBLIC_SITE_URL:origin,SUPABASE_SERVICE_ROLE_KEY:key},windowsHide:true,stdio:'ignore'});
const checks=[];let browser,owner,customer; const ownedAvatars=new Set(),ownedImages=new Set(); let page;
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);};
const login=async(prefix)=>{
 const jar=new Map();const client=createServerClient(config.url,config.publishable_key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
 const {data,error}=await client.auth.signInWithPassword(prefix==='owner-a'?{email:launchFixture.professional.email,password:launchFixture.professional.password}:prefix==='client'?{email:launchFixture.client.email,password:launchFixture.client.password}:{email:prefix+'@agende-staging.invalid',password:config.fixture_password});assert.equal(error?.code,undefined,'fixture authentication failed');
 return {client,user:data.user,jar,header:()=>[...jar].map(([n,v])=>`${n}=${v}`).join('; ')};
};

try {
 for(let n=0;n<80;n++){try{if((await fetch(origin+'/api/account/avatar')).status===401)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 owner=await login('owner-a');customer=await login('client');
 const wid=launchFixture.professional.workspaceId;
 const current=await owner.client.from('workspace_settings').select('logo_path,cover_path').eq('workspace_id',wid).single();assert.equal(current.error,null);
 assert.equal(current.data.logo_path,null,'preserve_existing_logo');assert.equal(current.data.cover_path,null,'preserve_existing_cover');
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext();await context.addCookies([...owner.jar].map(([name,value])=>({name,value,url:origin,httpOnly:true,sameSite:'Lax'})));
 page=await context.newPage();page.setDefaultTimeout(30000);
 const image=await sharp({create:{width:120,height:80,channels:3,background:'red'}}).jpeg().toBuffer();
 const replacement=await sharp({create:{width:100,height:100,channels:3,background:'blue'}}).png().toBuffer();
 for(const actor of [owner,customer]){
  const profile=await actor.client.from('profiles').select('avatar_path').eq('user_id',actor.user.id).single();assert.equal(profile.error,null);assert.equal(profile.data.avatar_path,null,'preserve_existing_avatar');
  const request=(method='GET',body,originHeader=origin)=>fetch(origin+'/api/account/avatar',{method,body,headers:{cookie:actor.header(),origin:originHeader}});
  await check('private avatar upload replacement isolation and removal '+(actor===owner?'professional':'client'),async()=>{
   assert.equal((await request('PUT',image,'https://attacker.invalid')).status,403);
   assert.equal((await request('PUT',Buffer.from('<svg/>'))).status,422);
   ownedAvatars.add(actor);assert.equal((await request('PUT',image)).status,200);
   const first=(await actor.client.from('profiles').select('avatar_path').eq('user_id',actor.user.id).single()).data.avatar_path;
   assert.equal((await request()).status,200);
   const other=actor===owner?customer:owner;assert.ok((await other.client.storage.from('account-avatars').download(first)).error);
   assert.equal((await request('PUT',replacement)).status,200);
   assert.ok(!(await admin.storage.from('account-avatars').list('avatars/'+actor.user.id)).data.some(x=>x.name===first.split('/').at(-1)));
   await page.reload();assert.equal((await request()).status,200);
   if(actor===customer){
    const related=(await owner.client.from('workspace_clients').select('id,full_name').eq('workspace_id',wid).eq('linked_user_id',actor.user.id).single()).data;assert.ok(related);
    const response=await fetch(origin+'/api/clients/avatar?clientId='+related.id,{headers:{cookie:owner.header()}});assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    const foreign=await login('owner-b');assert.equal((await fetch(origin+'/api/clients/avatar?clientId='+related.id,{headers:{cookie:foreign.header()}})).status,404);
    const last=(await owner.client.from('appointments').select('starts_at,professional_member_id').eq('client_id',related.id).order('starts_at',{ascending:false}).limit(1).single()).data;
    const catalog=(await owner.client.rpc('list_public_booking_catalog',{p_slug:launchFixture.professional.slug})).data;
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:catalog.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(last.starts_at));
    await page.goto(`${origin}/app/agenda?date=${day}&professional=${last.professional_member_id}`);
    await page.getByRole('button').filter({hasText:related.full_name}).first().click();await page.getByRole('dialog').waitFor();
    const img=page.getByRole('dialog').locator(`img[src="/api/clients/avatar?clientId=${related.id}"]`);await img.waitFor();assert.ok(await img.evaluate(el=>el.decode().then(()=>el.naturalWidth>0).catch(()=>false)));
    await page.screenshot({path:'docs/homologation/launch-client-avatar-agenda-20261020.png',fullPage:true});
    checks.push({name:'real agenda detail renders linked client name and global avatar, foreign tenant image denied',status:'PASS'});
   }

   assert.equal((await request('DELETE')).status,200);ownedAvatars.delete(actor);assert.equal((await request()).status,204);
  });
 }
 await page.goto(origin+'/app/configuracoes/perfil');
 const choose=async(form,kind,file)=>{
  if(kind==='logo'){await form.locator('#workspace-image-logo-gallery').setInputFiles(file);await form.getByRole('button',{name:'Usar este enquadramento',exact:true}).click();await form.getByAltText('Logo pronta para salvar').waitFor();}
  else await form.locator('input[name=image]').setInputFiles(file);
 };
 for(const kind of ['logo','cover'])await check(kind+' browser consent upload public render replacement and removal',async()=>{
  const form=page.locator('form').filter({has:page.locator(`input[name=kind][value=${kind}]`)});
  await choose(form,kind,{name:'synthetic.jpg',mimeType:'image/jpeg',buffer:image});
  await form.getByRole('button',{name:kind==='logo'?'Salvar logo':'Salvar capa',exact:true}).click();await form.getByRole('alert').filter({hasText:'Confirme que esta imagem'}).waitFor();
  await form.locator('input[name=publicConsent]').check();await choose(form,kind,{name:'synthetic.jpg',mimeType:'image/jpeg',buffer:image});
  ownedImages.add(kind);await form.getByRole('button',{name:kind==='logo'?'Salvar logo':'Salvar capa',exact:true}).click();await form.getByRole('status').waitFor();
  const old=(await owner.client.from('workspace_settings').select('logo_path,cover_path').eq('workspace_id',wid).single()).data[kind+'_path'];assert.ok(old);
  assert.equal((await fetch(config.url+'/storage/v1/object/public/workspace-logos/'+old)).status,200);
  await choose(form,kind,{name:'replacement.png',mimeType:'image/png',buffer:replacement});await form.locator('input[name=publicConsent]').check();
  const replaced=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/app/configuracoes/perfil');
  await form.getByRole('button',{name:kind==='logo'?'Salvar logo':'Salvar capa',exact:true}).click();await replaced;await page.reload();
  assert.ok(!(await admin.storage.from('workspace-logos').list(`${wid}/${kind}`)).data.some(x=>x.name===old.split('/').at(-1)));
  await page.goto(origin+'/p/'+launchFixture.professional.slug);
  const img=page.locator(`img[alt^="${kind==='logo'?'Logo':'Capa'} de"]`);await img.waitFor();assert.ok(await img.evaluate(el=>el.decode().then(()=>el.naturalWidth>0).catch(()=>false)));
  await page.screenshot({path:`docs/homologation/launch-${kind}-20261020.png`,fullPage:true});
  await page.goto(origin+'/app/configuracoes/perfil');
  const removed=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/app/configuracoes/perfil');
  await page.getByRole('button',{name:kind==='logo'?'Remover logo':'Remover capa',exact:true}).click();await removed;await page.reload();
  assert.equal((await owner.client.from('workspace_settings').select('logo_path,cover_path').eq('workspace_id',wid).single()).data[kind+'_path'],null);ownedImages.delete(kind);
 });
 await check('foreign workspace image mutations and private settings denied',async()=>{
  assert.ok((await customer.client.rpc('swap_workspace_image',{p_workspace_id:wid,p_kind:'logo',p_expected_path:null,p_new_path:null})).error);
  assert.equal((await customer.client.from('workspace_settings').select('workspace_id').eq('workspace_id',wid)).data.length,0);
 });
}catch(error){writeFileSync('.env.launch-media-private-error.txt',String(error.stack));checks.push({name:'workspace media acceptance',status:'FAIL',code:error.name});process.exitCode=1;}
finally{
 for(const actor of ownedAvatars)await fetch(origin+'/api/account/avatar',{method:'DELETE',headers:{cookie:actor.header(),origin}});
 for(const kind of ownedImages){const row=(await owner.client.from('workspace_settings').select('logo_path,cover_path').eq('workspace_id',launchFixture.professional.workspaceId).single()).data;const r=await owner.client.rpc('swap_workspace_image',{p_workspace_id:launchFixture.professional.workspaceId,p_kind:kind,p_expected_path:row[kind+'_path'],p_new_path:null});checks.push({name:'restore own '+kind,status:r.error?'FAIL':'PASS'});}
 await browser?.close();server.kill();
 writeFileSync('docs/homologation/launch-workspace-media-20261020.json',JSON.stringify({checked_at:new Date().toISOString(),project,production_writes:0,mode:'real Storage/PostgREST, local Next, actual Edge browser',checks},null,2)+'\n');
}
