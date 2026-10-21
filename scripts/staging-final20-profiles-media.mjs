import {homologationEvidence} from './homologation-evidence.mjs';
// Real SMTP/PKCE forms, SSR, PostgREST and Storage. No production writes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {randomUUID,randomInt} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from 'playwright';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {existingStagingServerKey} from './staging-existing-server-key.mjs';
const project='fkpdudnnperufnmdwdlv',origin='http://localhost:3000',prefix=process.env.AGENDE_PROFILES_FIXTURE_PREFIX??'.env.profiles-media';
assert.match(prefix,/^[.]env[.]profiles-media(?:-[a-z0-9-]+)?$/);
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));assert.equal(config.url,`https://${project}.supabase.co`);
const bundles=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?bundles(`${dir}/${e.name}`):e.name.endsWith('.js')?[`${dir}/${e.name}`]:[]);
assert.ok(bundles('.next/static').some(p=>readFileSync(p,'utf8').includes(config.url)),'Staging build required');
const key=existingStagingServerKey();
assert.ok(!bundles('.next/static').some(p=>readFileSync(p,'utf8').includes(key)),'Server credential must not exist in browser assets');
const admin=createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const resume=process.argv.includes('--resume');assert.ok(resume||!existsSync(prefix+'-fixtures.json'),'Never replace an existing fixture');
const mailbox=process.env.AGENDE_STAGING_MAILBOX;assert.match(mailbox??'',/^[^@+\s]+@gmail[.]com$/);
const now=Date.now(),fixtures=resume?JSON.parse(readFileSync(prefix+'-fixtures.json','utf8')):Object.fromEntries(['client','professional'].map(role=>[role,{email:mailbox.replace('@',`+agende-media-${role}-${now}@`),password:randomUUID()+'aA2!',phone:'329'+randomInt(10000000,99999999)}]));
const save=()=>writeFileSync(prefix+'-fixtures.json',JSON.stringify(fixtures));save();
const checks=resume?JSON.parse(readFileSync(homologationEvidence('profiles-media.json'),'utf8')).checks.filter(x=>x.status==='PASS'):[];
let completed=false;
const report=()=>writeFileSync(homologationEvidence('profiles-media.json'),JSON.stringify({project,checked_at:new Date().toISOString(),latest_run_passed:completed,earlier_attempts:resume?['final20-profiles-media-first-attempt.json']:[],checks:[...new Map(checks.map(x=>[x.name,x])).values()]},null,2)+'\n');
const record=name=>{checks.push({name,status:'PASS',mode:'real staging Auth/SMTP/PostgREST/Storage and own Next server'});report();console.log('PASS '+name);};
const ok=async promise=>{const r=await promise;assert.equal(r.error,null,r.error?.code);return r.data;};
const socket=createServer();await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(3000,'::1',resolve);});await new Promise(resolve=>socket.close(resolve));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','::1','--port','3000'],{windowsHide:true,stdio:'ignore',env:{...process.env,SUPABASE_SERVICE_ROLE_KEY:key,SITE_URL:origin,NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key}});
let browser;const clients={},pages={},contexts={};
try {
  for(let i=0;i<60;i++){try{if((await fetch('http://[::1]:3000/login')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP localhost [::1]']});
  for(const role of ['client','professional']) {
    const f=fixtures[role],context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(30000);contexts[role]=context;pages[role]=page;
    if(!resume){
      await page.goto(`${origin}/cadastro?intent=${role}&plan=solo`);
      assert.equal(await page.locator('input[name=intendedUse]').inputValue(),role);
      for(const [name,value] of Object.entries({fullName:'Homologação '+role,email:f.email,phone:f.phone,password:f.password,confirmPassword:f.password}))await page.locator(`input[name=${name}]`).fill(value);
      await page.getByRole('checkbox').check();await page.getByRole('button',{name:role==='client'?'Criar conta de cliente':'Criar conta profissional',exact:true}).click();await page.waitForURL('**/verificar-email?status=sent');record(role+' form signup preserves explicit intent');
    }
  }
  if(!resume){console.log('WAITING delivered client and professional signup links');
    for(const role of ['client','professional']){
      const path=prefix+'-'+role+'-link.txt',until=Date.now()+30*60*1000;
      while(!existsSync(path)){assert.ok(Date.now()<until,'Delivered email link unavailable');await new Promise(r=>setTimeout(r,1000));}
      const url=new URL(readFileSync(path,'utf8').trim());assert.equal(url.origin,config.url);assert.equal(url.pathname,'/auth/v1/verify');assert.equal(new URL(url.searchParams.get('redirect_to')).href,origin+'/auth/callback');
      await pages[role].goto(url.href);await pages[role].waitForURL(role==='client'?'**/cliente/perfil?inicio=1':'**/onboarding');record(role+' actual delivered email confirms with original PKCE verifier');
    }
  }
  for(const role of ['client','professional']){
    const f=fixtures[role],client=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
    const signed=await ok(client.auth.signInWithPassword({email:f.email,password:f.password}));f.id=signed.user.id;clients[role]=client;save();
    if(resume){await pages[role].goto(origin+'/login');await pages[role].locator('input[name=email]').fill(f.email);await pages[role].locator('input[name=password]').fill(f.password);await pages[role].getByRole('button',{name:'Entrar',exact:true}).click();await pages[role].waitForURL(role==='client'?'**/cliente':f.workspaceId?'**/app':'**/onboarding');}
  }
  const c=fixtures.client,p=fixtures.professional,cp=pages.client,pp=pages.professional;
  assert.equal((await ok(admin.from('workspaces').select('id').eq('owner_user_id',c.id))).length,0);
  assert.equal((await ok(clients.client.from('workspace_members').select('id').eq('user_id',c.id))).length,0);record('client has client profile and zero salon, memberships or trial creation');
  await cp.goto(origin+'/cliente/perfil');
  for(const city of ['Juiz de Fora','']){
    await cp.locator('input[name=fullName]').fill('Cliente Homologado');await cp.locator('input[name=phone]').fill('(32) 99999-1234');await cp.locator('input[name=residenceCity]').fill(city);
    await cp.getByRole('button',{name:'Salvar alterações',exact:true}).click();await cp.getByRole('status').filter({hasText:'Seus dados foram salvos.'}).waitFor();await cp.reload();
    const row=await ok(clients.client.from('profiles').select('full_name,phone,residence_city').eq('user_id',c.id).single());assert.equal(row.full_name,'Cliente Homologado');assert.equal(row.phone,'+5532999991234');assert.equal(row.residence_city,city||null);
  }record('client name, phone and optional/cleared city persist through form and reload');
  if(!p.workspaceId){await pp.locator('input[name=plan][value=equipe]').check();await pp.getByRole('button',{name:'Continuar para o teste de 7 dias',exact:true}).click();await pp.waitForURL('**/onboarding?etapa=salao');await pp.locator('input[name=name]').fill('Media QA '+now);await pp.getByRole('button',{name:'Criar salão e começar teste grátis',exact:true}).click();await pp.waitForURL('**/app?setup=1');
    const owned=await ok(clients.professional.from('workspaces').select('id,slug').eq('owner_user_id',p.id).single());p.workspaceId=owned.id;p.slug=owned.slug;save();}
  const sub=await ok(clients.professional.from('subscriptions').select('plan,status,trial_started_at,trial_ends_at').eq('workspace_id',p.workspaceId).single());assert.equal(sub.plan,'equipe');assert.equal(sub.status,'trialing');assert.equal(new Date(sub.trial_ends_at)-new Date(sub.trial_started_at),7*86400000);record('professional selected Equipe, created own salon and persisted seven-day trial');
  await pp.goto(origin+'/app/configuracoes/geral');
  for(const [name,value] of Object.entries({name:'Estúdio Media QA',businessPhone:'(32) 99999-5678',businessEmail:'qa@example.invalid',address:'Rua QA, 123',city:'Juiz de Fora',postalCode:'36010-041'}))await pp.locator(`[name=${name}]`).fill(value);
  await pp.locator('select[name=state]').selectOption('MG');await pp.locator('select[name=timezone]').selectOption('America/Manaus');await pp.getByRole('button',{name:'Salvar dados',exact:true}).click();await pp.getByRole('alert').filter({hasText:'Configurações salvas.'}).waitFor().catch(()=>{});
  await pp.reload();assert.equal(await pp.locator('[name=address]').inputValue(),'Rua QA, 123');assert.equal(await pp.locator('select[name=timezone]').inputValue(),'America/Manaus');
  const settings=await ok(clients.professional.from('workspace_settings').select('*').eq('workspace_id',p.workspaceId).single());assert.equal(settings.business_phone,'+5532999995678');assert.equal(settings.postal_code,'36010041');record('commercial name, phone, email, address, city, UF, CEP and timezone persist through actual form');
  const image=await sharp({create:{width:120,height:80,channels:3,background:'red'}}).jpeg().toBuffer();
  const replacement=await sharp({create:{width:100,height:100,channels:3,background:'blue'}}).png().toBuffer();
  for(const role of ['client','professional']){
    const context=contexts[role],f=fixtures[role],req=(method='GET',data,originHeader=origin)=>context.request.fetch(origin+'/api/account/avatar',{method,data,headers:{Origin:originHeader}});
    assert.equal((await req('PUT',image,'https://attacker.invalid')).status(),403);
    assert.equal((await req('PUT',Buffer.from('<svg/>'))).status(),422);
    assert.equal((await req('PUT',image)).status(),200);
    const first=await ok(clients[role].from('profiles').select('avatar_path').eq('user_id',f.id).single());assert.ok(first.avatar_path.startsWith('avatars/'+f.id+'/'));
    assert.equal((await req()).status(),200);assert.ok((await clients[role==='client'?'professional':'client'].storage.from('account-avatars').download(first.avatar_path)).error);
    assert.equal((await req('PUT',replacement)).status(),200);
    assert.ok(!(await ok(admin.storage.from('account-avatars').list('avatars/'+f.id))).some(x=>x.name===first.avatar_path.split('/').at(-1)));
    await pages[role].reload();assert.equal((await req()).status(),200);
    assert.equal((await req('DELETE')).status(),200);assert.equal((await req()).status(),204);record(role+' private photo upload, normalization, replacement, removal, reload and isolation');
  }
  await pp.goto(origin+'/app/configuracoes/perfil');
  const chooseImage=async(form,kind,file)=>{
    if(kind==='logo'){
      await form.locator('#workspace-image-logo-gallery').setInputFiles(file);
      await form.getByRole('button',{name:'Usar este enquadramento',exact:true}).click();
      await form.getByAltText('Logo pronta para salvar').waitFor();
    }else await form.locator('input[name=image]').setInputFiles(file);
  };
  for(const kind of ['logo','cover']){
    const form=pp.locator('form').filter({has:pp.locator(`input[name=kind][value=${kind}]`)});
    await chooseImage(form,kind,{name:'test.jpg',mimeType:'image/jpeg',buffer:image});
    await form.getByRole('button',{name:kind==='logo'?'Salvar logo':'Salvar capa',exact:true}).click();await form.getByRole('alert').filter({hasText:'Confirme que esta imagem'}).waitFor();
    await form.locator('input[name=publicConsent]').check();await chooseImage(form,kind,{name:'test.jpg',mimeType:'image/jpeg',buffer:image});await form.getByRole('button',{name:kind==='logo'?'Salvar logo':'Salvar capa',exact:true}).click();await form.getByRole('status').waitFor();
    const old=(await ok(clients.professional.from('workspace_settings').select('logo_path,cover_path').eq('workspace_id',p.workspaceId).single()))[kind+'_path'];assert.ok(old.includes('/'+kind+'/'));
    const publicResponse=await fetch(config.url+'/storage/v1/object/public/workspace-logos/'+old);assert.equal(publicResponse.status,200);
    assert.ok((await clients.client.storage.from('workspace-logos').remove([old])).error || (await ok(admin.storage.from('workspace-logos').list(`${p.workspaceId}/${kind}`))).some(x=>x.name===old.split('/').at(-1)));
    await chooseImage(form,kind,{name:'replacement.png',mimeType:'image/png',buffer:replacement});await form.locator('input[name=publicConsent]').check();
    const replaced=pp.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/app/configuracoes/perfil');
    await form.getByRole('button',{name:kind==='logo'?'Salvar logo':'Salvar capa',exact:true}).click();await replaced;await pp.reload();
    assert.ok(!(await ok(admin.storage.from('workspace-logos').list(`${p.workspaceId}/${kind}`))).some(x=>x.name===old.split('/').at(-1)));
    await pp.goto(origin+'/p/'+p.slug);assert.equal(await pp.locator(`img[alt^="${kind==='logo'?'Logo':'Capa'} de"]`).count(),1);await pp.goto(origin+'/app/configuracoes/perfil');
    const removed=pp.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/app/configuracoes/perfil');
    await pp.getByRole('button',{name:kind==='logo'?'Remover logo':'Remover capa',exact:true}).click();await removed;await pp.reload();
    assert.equal((await ok(clients.professional.from('workspace_settings').select('logo_path,cover_path').eq('workspace_id',p.workspaceId).single()))[kind+'_path'],null);record(kind+' public consent, upload, rendering, replacement, old-byte cleanup and removal');
  }
  assert.ok((await clients.client.rpc('swap_workspace_image',{p_workspace_id:p.workspaceId,p_kind:'logo',p_expected_path:null,p_new_path:null})).error);
  assert.equal((await ok(clients.client.from('workspace_settings').select('workspace_id').eq('workspace_id',p.workspaceId))).length,0);record('foreign user denied workspace image RPC and settings rows');
  await ok(clients.professional.rpc('create_client_profile'));await pp.goto(origin+'/cliente');assert.equal(new URL(pp.url()).pathname,'/cliente');await pp.goto(origin+'/app');assert.equal(new URL(pp.url()).pathname,'/app');record('same professional identity can enable client area without a second subscription');
  await cp.goto(origin+'/cliente/descobrir');await cp.goto(origin+'/cliente/agendamentos');assert.equal(new URL(cp.url()).pathname,'/cliente/agendamentos');record('independent client can open search and own appointments without salon onboarding');
  record('server credential absent from all browser JavaScript assets');
  completed=true;
} catch(error){writeFileSync(prefix+'-error.txt',String(error.stack));checks.push({name:'remaining real profile/media journey',status:'FAIL',diagnostic:'private local file; no credentials published'});report();process.exitCode=1;}
finally {
  // Only this runner's fresh fixtures; never replace/remove an existing photo.
  for(const [role,context] of Object.entries(contexts)){
    try{if(fixtures[role].id)await context.request.delete(origin+'/api/account/avatar',{headers:{Origin:origin}});}catch{}
    try{await clients[role]?.auth.signOut({scope:'local'});}catch{}
  }
  await browser?.close();server.kill();report();
}
