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
const clientFixture=process.env.AGENDE_CLIENT_FIXTURE_FILE?JSON.parse(readFileSync(process.env.AGENDE_CLIENT_FIXTURE_FILE,'utf8')).client:null;
if(clientFixture)assert.ok(clientFixture.email.includes('+agende-media-client-'),'owned_synthetic_client_required');
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key,VERCEL_ENV:'',SUPABASE_SERVICE_ROLE_KEY:''};
if(process.argv.includes('--build'))assert.equal(spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{env,stdio:'inherit',windowsHide:true}).status,0);
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...env,SITE_URL:origin,NEXT_PUBLIC_SITE_URL:origin},windowsHide:true,stdio:'ignore'});
const anon=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const checks=[],marker=`Synthetic auth-whatsapp acceptance ${Date.now()}`;let browser,owner,customer,bookingId,debugPage,currentCheck='startup',subphase='startup';
const check=async(name,fn)=>{currentCheck=name;await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);};
const login=async(prefix)=>{
 const jar=new Map();const client=createServerClient(config.url,config.publishable_key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
 const credentials=prefix==='client'&&clientFixture?{email:clientFixture.email,password:clientFixture.password}:{email:prefix+'@agende-staging.invalid',password:config.fixture_password};
 const result=await client.auth.signInWithPassword(credentials);assert.ok(!result.error,'fixture_login_failed');
 return {client,user:result.data.user,password:credentials.password,jar,headers:()=>({cookie:[...jar].map(([name,value])=>`${name}=${value}`).join('; ')})};
};
const ok=async promise=>{const result=await promise;assert.ok(!result.error,'staging_operation_failed');return result.data;};
try {
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(origin+'/api/account/avatar')).status===401){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'server_unavailable');
 const second=process.env.AGENDE_STAGING_BOOKING_SLUG==='staging-studio-b';owner=await login(second?'owner-b':'owner-a');customer=await login('client');const foreign=await login(second?'owner-a':'owner-b');
 const slug=process.env.AGENDE_STAGING_BOOKING_SLUG??'staging-studio-a';assert.ok(['staging-studio-a','staging-studio-b'].includes(slug));const catalog=await ok(anon.rpc('list_public_booking_catalog',{p_slug:slug}));
 const service=catalog.services[0];const professional=catalog.professionals.find(person=>person.service_ids.includes(service.id));assert.ok(professional,'fixture_professional_required');
 let day,slots;for(let i=10;i<17;i++){
  day=new Date(Date.now()+i*86400000).toISOString().slice(0,10);
  const found=await ok(anon.rpc('list_public_available_slots',{p_slug:slug,p_service_id:service.id,p_professional_member_id:professional.id,p_local_date:day}));
  if(found.length>1){slots=found;break;}
 }assert.ok(slots?.length>1,'fixture_slots_required');
 const selected=slots[0].starts_at;
 const workspace=(await ok(owner.client.from('workspaces').select('id').eq('slug',slug).single())).id;
 const bookingArgs={p_slug:slug,p_service_id:service.id,p_professional_member_id:professional.id,p_starts_at:selected,p_full_name:'Cliente sintético',p_phone:'+5532999999999',p_email:customer.user.email};
 await check('anonymous REST and RPC deny actual available booking without creating an appointment',async()=>{
  const count=async()=>((await owner.client.from('appointments').select('id',{count:'exact',head:true}).eq('workspace_id',workspace)).count);
  const before=await count();assert.ok(Number.isInteger(before),'appointment_count_failed');
  assert.ok((await anon.rpc('create_public_appointment',bookingArgs)).error,'anonymous_rpc_accepted');
  const response=await fetch(`${config.url}/rest/v1/rpc/create_public_appointment`,{method:'POST',headers:{apikey:config.publishable_key,'Content-Type':'application/json'},body:JSON.stringify(bookingArgs)});
  assert.ok(response.status===401||response.status===403,'anonymous_rest_accepted');assert.ok(await count()===before,'anonymous_created_appointment');
 });
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(30000);
 await check('mobile visitor keeps all selections through real login; no booking is created during login',async()=>{
  await page.goto(`${origin}/p/${slug}/agendar?servico=${service.id}`);
  if(catalog.professionals.filter(person=>person.service_ids.includes(service.id)).length>1)await page.getByRole('button',{name:`Escolher ${professional.display_name}`,exact:true}).click();
  const label=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,weekday:'long',day:'numeric',month:'long'}).format(new Date(day+'T15:00:00Z'));
  await page.getByRole('button',{name:label,exact:true}).click();
  const time=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(selected));
  await page.getByRole('button',{name:time,exact:true}).click();await page.waitForURL('**/login?next=**');
  const draft=(await context.cookies()).find(cookie=>cookie.name==='agende_booking_draft');assert.ok(draft?.httpOnly,'draft_not_http_only');
  const selection=JSON.parse(decodeURIComponent(draft.value)).selection;
  assert.ok(selection.serviceId===service.id&&selection.professionalMemberId===professional.id&&selection.localDate===day&&Date.parse(selection.startsAt)===Date.parse(selected),'draft_selection_changed');
  await page.locator('input[name=email]').fill(customer.user.email);await page.locator('input[name=password]').fill(customer.password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(`**/p/${slug}/agendar`);
  const history=await ok(customer.client.rpc('list_my_appointments'));
  assert.ok(!history.some(row=>row.status!=='cancelled'&&Date.parse(row.starts_at)===Date.parse(selected)&&row.professional_member_id===professional.id),'login_created_booking');
  const after=(await context.cookies()).find(cookie=>cookie.name==='agende_booking_draft');assert.ok(after,'draft_lost_after_login');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'mobile_horizontal_overflow');
 });
 await check('actual authenticated Server Action creates one booking and publishes it in the free client area',async()=>{
  debugPage=page;subphase='edit_client_details';if(!await page.locator('input[name=fullName]').isVisible())await page.getByRole('button',{name:'Alterar meus dados',exact:true}).click();
  if(await page.locator('input[name=fullName]').isVisible()){
   assert.ok(await page.locator('input[name=fullName]').inputValue(),'fixture_name_required');
   assert.ok(await page.locator('input[name=phone]').inputValue(),'fixture_phone_required');
   await page.locator('textarea[name=customerNote]').fill(marker);
   await page.getByRole('button',{name:'Continuar',exact:true}).click();
  }
  subphase='click_final_booking';await page.getByRole('button',{name:'Reservar este horário',exact:true}).click();subphase='wait_receipt';
  await page.getByRole('heading',{name:'Solicitação recebida',exact:true}).waitFor();
  const history=await ok(customer.client.rpc('list_my_appointments'));
  const matches=history.filter(row=>row.status!=='cancelled'&&Date.parse(row.starts_at)===Date.parse(selected)&&row.professional_member_id===professional.id);
  assert.ok(matches.length===1,'booking_not_unique_or_missing');bookingId=matches[0].id;
  assert.ok(matches[0].status==='scheduled','unexpected_booking_status');
  assert.ok(!(await context.cookies()).some(cookie=>cookie.name==='agende_booking_draft'),'draft_not_cleared_after_commit');
  debugPage=null;await page.goto(origin+'/cliente/agendamentos');await page.getByText(service.name,{exact:true}).first().waitFor();
  assert.ok(!page.url().includes('planos'),'customer_sent_to_saas');
 });
 await check('current real WhatsApp contract denies foreign tenant and client sessions',async()=>{
  for(const account of [foreign,customer])assert.ok((await account.client.rpc('get_appointment_whatsapp',{p_appointment_id:bookingId})).error,'contact_exposed_to_foreign_actor');
  const row=await ok(owner.client.rpc('get_appointment_whatsapp',{p_appointment_id:bookingId}));assert.ok(row.clientName&&row.phone&&row.serviceName&&row.professionalName&&row.startsAt&&row.status,'incomplete_contact_contract');
 });
 await check('real Server Action supplies current authorized contact model and copy-only manual message',async()=>{
  const staff=await browser.newContext({viewport:{width:390,height:844}});
  await staff.addCookies([...owner.jar].map(([name,value])=>({name,value,url:origin,httpOnly:true,sameSite:'Lax'})));
  const detail=await staff.newPage();debugPage=detail;detail.setDefaultTimeout(30000);
  subphase='open_staff_agenda';await detail.goto(`${origin}/app/agenda?date=${day}&professional=${professional.id}`);
  const time=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(selected));
  subphase='open_appointment';await detail.getByRole('button').filter({hasText:new RegExp('^'+time+'–')}).filter({hasText:service.name}).filter({hasText:'Agendado'}).first().click();
  subphase='wait_dialog';await detail.getByRole('dialog').waitFor();subphase='copy_action';
  let serialized='';
  await detail.route('**/app/agenda**',async route=>{
    if(route.request().method()!=='POST')return route.continue();
    const response=await route.fetch();assert.ok(response.ok(),'server_action_failed');
    serialized=await response.text();await route.fulfill({response,body:serialized});
  });
  await detail.getByRole('button',{name:'Não abriu? Copiar mensagem',exact:true}).click();
  subphase='read_copy_message';await detail.getByRole('textbox',{name:'Mensagem para copiar',exact:true}).waitFor();
  assert.ok(serialized.includes('phoneE164')&&serialized.includes('clientName')&&serialized.includes('localTime')&&serialized.includes(bookingId),'server_action_contact_contract_missing');
  subphase='read_copy_message';const message=await detail.getByRole('textbox',{name:'Mensagem para copiar',exact:true}).inputValue();
  assert.ok(message.includes('ainda aguarda confirmação')&&!message.includes('está confirmado!'),'copy_message_claimed_confirmation');
  const after=await ok(owner.client.from('appointments').select('status').eq('id',bookingId).single());assert.ok(after.status==='scheduled','copy_changed_status');
  debugPage=null;await staff.close();
 });
 await check('manual redirect reflects pending and confirmed messages without sending or changing status',async()=>{
  const read=async()=>{
   const before=await ok(owner.client.from('appointments').select('status,starts_at').eq('id',bookingId).single());
   const response=await fetch(`${origin}/api/appointments/whatsapp?id=${bookingId}`,{headers:owner.headers(),redirect:'manual'});
   const after=await ok(owner.client.from('appointments').select('status,starts_at').eq('id',bookingId).single());
   assert.ok(JSON.stringify(before)===JSON.stringify(after),'manual_open_mutated_appointment');
   assert.ok(response.status===302,'manual_redirect_failed');assert.ok(response.headers.get('cache-control')==='private, no-store','personal_response_cached');
   const target=new URL(response.headers.get('location'));assert.ok(target.origin==='https://wa.me'&&/^\/[1-9]\d{1,14}$/.test(target.pathname),'invalid_whatsapp_target');
   return target.searchParams.get('text');
  };
  const pending=await read();assert.ok(pending.includes('ainda aguarda confirmação')&&!pending.includes('está confirmado!'),'pending_claimed_confirmation');
  await ok(owner.client.rpc('set_appointment_status',{p_appointment_id:bookingId,p_status:'confirmed'}));
  const confirmed=await read();assert.ok(confirmed.includes('está confirmado!')&&confirmed.includes('👤 Profissional:'),'confirmed_template_invalid');
 });
 await check('cancelled booking cannot redirect or expose a message',async()=>{
  const id=bookingId;await ok(customer.client.rpc('cancel_my_appointment',{p_appointment_id:id}));bookingId=null;
  const response=await fetch(`${origin}/api/appointments/whatsapp?id=${id}`,{headers:owner.headers(),redirect:'manual'});
  assert.ok(response.status===422&&!response.headers.get('location'),'cancelled_redirected');
 });
}catch(error){if(debugPage)await debugPage.screenshot({path:'.env.auth-whatsapp-debug.png',fullPage:true});checks.push({name:currentCheck,status:'FAIL',subphase,code:error.name??'acceptance_failed',check: /^[a-z_]+$/.test(error.message??'')?error.message:'see_failed_phase'});console.log('FAIL '+currentCheck);process.exitCode=1;
}finally{
 if(bookingId&&customer){const result=await customer.client.rpc('cancel_my_appointment',{p_appointment_id:bookingId});checks.push({name:'cancel own synthetic booking',status:result.error?'FAIL':'PASS'});if(result.error)process.exitCode=1;}
 if(customer){const history=await customer.client.rpc('list_my_appointments');for(const row of history.data??[]){if(row.customer_note===marker&&row.status!=='cancelled'){const r=await customer.client.rpc('cancel_my_appointment',{p_appointment_id:row.id});checks.push({name:'cleanup own marker after uncertain response',status:r.error?'FAIL':'PASS'});if(r.error)process.exitCode=1;}}}
 await browser?.close();server.kill();
 writeFileSync('docs/homologation/auth-whatsapp-required-staging-20261016.json',JSON.stringify({checked_at:new Date().toISOString(),project,production_access:false,migrations_executed:false,deployments_executed:false,service_role_used:false,external_whatsapp_requests:0,frontend_gaps:[],checks},null,2)+'\n');
}
