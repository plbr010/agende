// Real local Next build -> staging GoTrue/PostgREST. No production or SMTP claims.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
assert.ok(process.env.AGENDE_PLAYWRIGHT_MODULE_PATH,'Set the installed Playwright module path');
const {chromium}=createRequire(import.meta.url)(process.env.AGENDE_PLAYWRIGHT_MODULE_PATH);
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
const redact=value=>String(value??'').replaceAll(config.fixture_password,'[redacted]').replaceAll(config.publishable_key,'[redacted]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted]');
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const client=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=async promise=>{const r=await promise;assert.equal(r.error,null,r.error?.message);return r.data;};
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const base=`http://127.0.0.1:${port}`,checks=[],evidence='docs/evidence/functional-2026-10-14';mkdirSync(evidence,{recursive:true});
let browser,server,w,s,enabled,serviceId,lastPage,appointmentId,workingHoursId,restored=true,failure;
let serverDiagnostics='';
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
try{
  await ok(client.auth.signInWithPassword({email:'owner-a@agende-staging.invalid',password:config.fixture_password}));
  w=(await ok(client.from('workspaces').select('id,name,slug').eq('name','Staging Studio A')))[0];assert.ok(w);
  s=await ok(client.from('workspace_settings').select('city,state').eq('workspace_id',w.id).single());
  enabled=await ok(client.rpc('get_workspace_discovery',{p_workspace_id:w.id}));
  await ok(client.rpc('update_workspace_settings',{p_workspace_id:w.id,p_name:w.name,p_slug:w.slug,p_city:'São Paulo',p_state:'SP'}));
  await ok(client.rpc('set_workspace_discovery',{p_workspace_id:w.id,p_enabled:false}));
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{windowsHide:true,env:{...process.env,
    NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key,NEXT_PUBLIC_SITE_URL:base},stdio:['ignore','pipe','pipe']});
  server.stderr.on('data',chunk=>{serverDiagnostics+=chunk;});
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Local Next server startup timeout')),30000);
    let log='';server.stdout.on('data',chunk=>{log+=chunk;if(log.includes('Ready in')){clearTimeout(timeout);resolve();}});
    server.once('error',reject);server.once('exit',()=>reject(new Error('Local server exited')));
  });
  browser=await chromium.launch({headless:true,channel:process.env.AGENDE_BROWSER_CHANNEL||undefined});const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();
  lastPage=page;
  await check('browser login creates a real staging session and opens manager settings',async()=>{
    await page.goto(base+'/login?next=%2Fapp%2Fconfiguracoes%2Fperfil');await page.getByLabel('E-mail',{exact:true}).fill('owner-a@agende-staging.invalid');
    await page.locator('input[name=password]').fill(config.fixture_password);await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await page.waitForURL('**/app/configuracoes/perfil');await page.getByText('Aparecer na busca de salões',{exact:true}).waitFor();
  });
  await check('manager publishes through the actual form and persistence survives reload',async()=>{
    await page.getByLabel('Quero aparecer na busca pública').check();await page.getByRole('button',{name:'Salvar publicação',exact:true}).click();
    await page.getByText('Publicação atualizada.',{exact:true}).waitFor();await page.reload();assert.equal(await page.getByLabel('Quero aparecer na busca pública').isChecked(),true);
  });
  const serviceName='Browser synthetic '+Date.now();
  await check('authenticated operational pages render without a server component boundary crash',async()=>{
    for(const [route,title] of [['agenda','Atendimentos'],['clientes','Clientes'],['equipe','Equipe'],['estoque','Estoque'],['pacotes','Pacotes'],['financeiro','Financeiro'],['relatorios','Relatórios'],['avaliacoes','Avaliações']]){
      await page.goto(base+'/app/'+route);await page.getByRole('heading',{name:title,exact:true}).waitFor();
    }
  });
  await check('browser creates service and professional link through the atomic RPC',async()=>{
    await page.goto(base+'/app/servicos');await page.getByRole('button',{name:'Novo serviço',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Nome',{exact:true}).fill(serviceName);
    await dialog.getByLabel('Tempo em minutos').fill('30');await dialog.getByLabel('Preço (R$)',{exact:true}).fill('50,00');
    await dialog.locator('input[name=professionalMemberIds]').first().check();await dialog.getByRole('button',{name:'Salvar serviço'}).click();
    await dialog.waitFor({state:'hidden'});serviceId=(await ok(client.from('services').select('id').eq('workspace_id',w.id).eq('name',serviceName)))[0]?.id;assert.ok(serviceId);
    assert.equal((await ok(client.from('professional_services').select('id').eq('service_id',serviceId).eq('active',true))).length,1);
    await page.screenshot({path:evidence+'/service-created-desktop.png',fullPage:true});
  });
  const guest=await browser.newContext({viewport:{width:390,height:844},permissions:[]}),search=await guest.newPage();
  await check('mobile city search renders real salon and global search ignores the previous city',async()=>{
    await search.goto(base+'/descobrir');await search.getByLabel('Cidade',{exact:true}).fill('São Paulo');await search.getByLabel('Estado',{exact:true}).selectOption('SP');
    await search.getByRole('button',{name:'Procurar estabelecimentos'}).click();await search.getByRole('link',{name:new RegExp(w.name)}).waitFor();
    await search.screenshot({path:evidence+'/city-search-mobile.png',fullPage:true});
    await search.getByLabel('Cidade',{exact:true}).fill('Salvador');await search.getByRole('radio',{name:'Nome do salão'}).click();
    await search.getByLabel('Nome do salão ou profissional',{exact:true}).fill(w.name);await search.getByRole('button',{name:'Procurar estabelecimentos'}).click();
    await search.getByRole('link',{name:new RegExp(w.name)}).waitFor();
    assert.ok(await search.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  });
  if(process.env.AGENDE_STAGING_SKIP_BOOKING!=='1')await check('mobile discovery to real booking persists on the professional agenda',async()=>{
    lastPage=search;
    const member=(await ok(client.from('professional_services').select('professional_member_id').eq('service_id',serviceId).eq('active',true)))[0].professional_member_id;
    const day=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
    const weekday=new Date(day+'T12:00:00Z').getUTCDay();
    const hours=await ok(client.from('professional_working_hours').select('id').eq('professional_member_id',member).eq('weekday',weekday));
    if(!hours.length)workingHoursId=(await ok(client.from('professional_working_hours').insert({workspace_id:w.id,professional_member_id:member,weekday,start_time:'08:00',end_time:'18:00'}).select('id').single())).id;
    await search.getByRole('link',{name:new RegExp(w.name)}).click();
    await search.getByRole('button',{name:'Agendar horário',exact:true}).click();
    await search.getByRole('button',{name:new RegExp(serviceName)}).click();
    const dateLabel=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',day:'numeric',month:'long'}).format(new Date(day+'T15:00:00Z'));
    await search.getByRole('button',{name:dateLabel,exact:true}).click();
    await search.getByRole('region',{name:'Escolher horário'}).getByRole('button',{name:/^\d\d:\d\d$/}).first().click();
    await search.getByLabel('Nome completo',{exact:true}).fill('Browser Cliente Sintetico');
    await search.getByLabel('Celular',{exact:true}).fill('32999999999');
    await search.getByLabel('E-mail',{exact:true}).fill('client@agende-staging.invalid');
    await search.getByRole('button',{name:'Continuar',exact:true}).click();
    await search.getByRole('button',{name:'Reservar este horário',exact:true}).click();
    await search.getByRole('heading',{name:'Seu horário está reservado',exact:true}).waitFor();
    const appointment=(await ok(client.from('appointments').select('id,status').eq('workspace_id',w.id).eq('service_id',serviceId)))[0];
    appointmentId=appointment?.id;assert.ok(appointmentId);assert.equal(appointment.status,'scheduled');
    lastPage=page;await page.goto(base+'/app/agenda?view=day&date='+day);
    await page.getByText(new RegExp(serviceName)).first().waitFor();
    await search.screenshot({path:evidence+'/booking-confirmed-mobile.png',fullPage:true});
    await search.goto(base+'/descobrir');await search.getByRole('radio',{name:'Nome do salão'}).click();
    await search.getByLabel('Nome do salão ou profissional',{exact:true}).fill(w.name);
    await search.getByRole('button',{name:'Procurar estabelecimentos'}).click();
    await search.getByRole('link',{name:new RegExp(w.name)}).waitFor();
  });
  await check('withdrawal through manager UI removes the salon from the next real browser search',async()=>{
    await page.goto(base+'/app/configuracoes/perfil');await page.getByLabel('Quero aparecer na busca pública').uncheck();await page.getByRole('button',{name:'Salvar publicação',exact:true}).click();
    await page.getByText('Publicação atualizada.',{exact:true}).waitFor();await search.getByRole('button',{name:'Procurar estabelecimentos'}).click();await search.getByText('Nenhum salão nesta busca',{exact:true}).waitFor();
  });
  await check('browser logout clears the session and a protected route returns to login',async()=>{
    await page.getByRole('button',{name:'Sair',exact:true}).click();await page.waitForURL(url=>url.pathname==='/');await page.goto(base+'/app/servicos');await page.waitForURL('**/login*');
  });
}catch(error){failure=error;failure.message=redact(error.message);failure.stack=redact(error.stack);if(lastPage)await lastPage.screenshot({path:evidence+'/browser-failure.png',fullPage:true}).catch(()=>{});}finally{
  await browser?.close();if(server){server.kill();}
  if(w&&s){try{
    if(!appointmentId&&serviceId)appointmentId=(await ok(client.from('appointments').select('id').eq('workspace_id',w.id).eq('service_id',serviceId)))[0]?.id;
    if(appointmentId)await ok(client.rpc('set_appointment_status',{p_appointment_id:appointmentId,p_status:'cancelled'}));
    if(workingHoursId)await ok(client.from('professional_working_hours').delete().eq('id',workingHoursId));
    await ok(client.rpc('set_workspace_discovery',{p_workspace_id:w.id,p_enabled:false}));
    await ok(client.rpc('update_workspace_settings',{p_workspace_id:w.id,p_name:w.name,p_slug:w.slug,p_city:s.city,p_state:s.state}));
    if(enabled)await ok(client.rpc('set_workspace_discovery',{p_workspace_id:w.id,p_enabled:true}));
    if(serviceId)await ok(client.from('services').update({archived_at:new Date().toISOString(),active:false}).eq('id',serviceId));
  }catch{restored=false;}}
  await client.auth.signOut();writeFileSync('docs/staging/browser-functional.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',checks,passed:!failure&&restored,booking_skipped:process.env.AGENDE_STAGING_SKIP_BOOKING==='1',booking_skip_reason:process.env.AGENDE_STAGING_SKIP_BOOKING==='1'?'Explicit bounded rerun; real booking fixture quota already reached':undefined,fixtures_restored:restored,synthetic_service_archived:Boolean(serviceId)&&restored,synthetic_booking_cancelled:Boolean(appointmentId)&&restored,production_connections:0,error:failure?.message,secrets_in_report:false},null,2)+'\n');
  if(failure) console.error(redact(serverDiagnostics));
}
if(failure)throw failure;assert.equal(restored,true);
