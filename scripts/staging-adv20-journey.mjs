// Real integrated UI + delivered SMTP + staging API/Storage. Never production.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID,randomInt,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {existingStagingServerKey} from './staging-existing-server-key.mjs';

const project='fkpdudnnperufnmdwdlv',origin='http://localhost:3000';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const cfg=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));assert.equal(cfg.url,`https://${project}.supabase.co`);
const f=JSON.parse(readFileSync('.env.profiles-media-final20-fixtures.json','utf8'));
const old=JSON.parse(readFileSync('.env.profiles-media-fixtures.json','utf8')).professional;
const staff=JSON.parse(readFileSync('.env.final20-employee-fixture.json','utf8'));
const mailbox=JSON.parse(readFileSync('.env.final-mailbox.json','utf8')).mailbox;
assert.match(mailbox,/^[^@+\s]+@gmail[.]com$/);
const customerFile=process.argv.includes('--fresh-ui')?'.env.adv20-ui-booking-fixture.json':process.argv.includes('--fresh')?'.env.adv20-fresh-booking-fixture.json':'.env.adv20-booking-fixture.json';const reuseConfirmed=process.argv.includes('--reuse-confirmed');const retry=process.argv.includes('--retry-before-signup')||reuseConfirmed;assert.ok(!existsSync(customerFile)||retry,'Never replace an unfinished booking fixture');
const customer=existsSync(customerFile)?JSON.parse(readFileSync(customerFile,'utf8')):{email:mailbox.replace('@',`+agende-adv20-booking-${Date.now()}@`),password:randomUUID()+'Aa2!',phone:'329'+randomInt(10000000,99999999)};
writeFileSync(customerFile,JSON.stringify(customer));
const customerE164='+55'+customer.phone.replace(/\D/g,'').replace(/^55(?=\d{11}$)/,'');
const customerDisplay=`(${customerE164.slice(3,5)}) ${customerE164.slice(5,10)}-${customerE164.slice(10)}`;
const checks=[],resources={services:[],hours:[],appointments:[],settings:[]};
const save=()=>writeFileSync('.env.adv20-journey-resources.json',JSON.stringify(resources));
const report=()=>writeFileSync('docs/homologation/adv20-integrated-journey.json',JSON.stringify({checked_at:new Date().toISOString(),project,mode:'actual Edge browser, local Next, staging GoTrue/PostgREST/Storage and delivered SMTP',production_writes:0,external_whatsapp_requests:0,reused_confirmed_fixture:reuseConfirmed,checks},null,2)+'\n');
const record=name=>{checks.push({name,status:'PASS'});report();console.log('PASS '+name);};
const ok=async p=>{const r=await p;assert.ok(!r.error,'staging_operation_failed');return r.data;};
const make=()=>createClient(cfg.url,cfg.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const login=async credentials=>{
 const jar=new Map(),client=createServerClient(cfg.url,cfg.publishable_key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(x=>jar.set(x.name,x.value))}});
 const signed=await ok(client.auth.signInWithPassword({email:credentials.email,password:credentials.password}));
 return {client,user:signed.user,jar,headers:()=>({cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')})};
};
const settingsArgs=(w,s,extra={})=>({p_workspace_id:w.id,p_name:w.name,p_slug:w.slug,p_business_phone:s.business_phone,p_business_email:s.business_email,p_address:s.address,p_city:s.city,p_state:s.state,p_postal_code:s.postal_code,p_description:s.description,p_instagram:s.instagram,p_timezone:s.timezone,p_logo_path:null,p_clear_logo:false,...extra});
const socket=createServer();await new Promise((r,j)=>{socket.once('error',j);socket.listen(3000,'::1',r);});await new Promise(r=>socket.close(r));
const key=existingStagingServerKey();
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','::1','--port','3000'],{windowsHide:true,stdio:'ignore',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:cfg.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:cfg.publishable_key,SUPABASE_SERVICE_ROLE_KEY:key,SITE_URL:origin,NEXT_PUBLIC_SITE_URL:origin}});
let browser,owner,employee,foreign,customerSession,oldOwner,member,photoChanged=false,avatarChanged=false,debugPage,phase='startup';
try{
 for(let i=0;i<80;i++){try{if((await fetch('http://[::1]:3000/api/account/avatar')).status===401)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 owner=await login(f.professional);employee=await login(staff);oldOwner=await login(old);foreign=await login({email:'owner-b@agende-staging.invalid',password:cfg.fixture_password});
 const w=await ok(owner.client.from('workspaces').select('id,name,slug').eq('id',f.professional.workspaceId).single());
 member=(await ok(owner.client.from('workspace_members').select('id').eq('workspace_id',w.id).eq('user_id',employee.user.id).single())).id;
 await ok(owner.client.from('professional_profiles').update({display_name:'Ágata Pereira QA',booking_enabled:true}).eq('member_id',member));
 const currentPhoto=await ok(owner.client.from('professional_profiles').select('photo_path').eq('member_id',member).single());assert.equal(currentPhoto.photo_path,null,'preserve_existing_professional_photo');
 const s=await ok(owner.client.from('workspace_settings').select('*').eq('workspace_id',w.id).single());resources.settings.push({w,s,client:'owner'});save();
 await ok(owner.client.rpc('set_workspace_discovery',{p_workspace_id:w.id,p_enabled:true}));
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP localhost [::1]']});
 const context=await browser.newContext();await context.addCookies([...owner.jar].map(([name,value])=>({name,value,url:origin,httpOnly:true,sameSite:'Lax'})));
 const page=await context.newPage();debugPage=page;page.setDefaultTimeout(30000);
 phase='professional_photo';await page.goto(origin+'/app/equipe');
 await page.locator('[data-slot=card]').filter({hasText:'Ágata Pereira QA'}).getByRole('button',{name:'Editar',exact:true}).click();
 const editor=page.getByRole('region',{name:'Foto de Ágata Pereira QA',exact:true});
 const image=await sharp({create:{width:120,height:120,channels:3,background:'blue'}}).png().toBuffer();
 await editor.locator('input[type=file]').setInputFiles({name:'owned-qa.png',mimeType:'image/png',buffer:image});photoChanged=true;
 await editor.getByRole('status').filter({hasText:'Foto salva.'}).waitFor();await page.reload();await page.locator('[data-slot=card]').filter({hasText:'Ágata Pereira QA'}).getByRole('button',{name:'Editar',exact:true}).click();
 assert.ok(await editor.locator('img').evaluate(el=>el.decode().then(()=>el.naturalWidth>0).catch(()=>false)));
 record('new invited professional photo saved by owner and rendered after reload');
 phase='service_form';const serviceName='Corte Jornada P0 '+Date.now();
 await page.goto(origin+'/app/servicos');await page.getByRole('button',{name:'Novo serviço',exact:true}).click();const form=page.getByRole('dialog');
 await form.getByLabel('Nome',{exact:true}).fill(serviceName);await form.getByLabel('Tempo em minutos').fill('30');await form.getByLabel('Preço (R$)',{exact:true}).fill('50,00');
 await form.locator(`input[name=professionalMemberIds][value="${member}"]`).check();await form.getByRole('button',{name:'Salvar serviço',exact:true}).click();await form.waitFor({state:'hidden'});
 const service=await ok(owner.client.from('services').select('id').eq('workspace_id',w.id).eq('name',serviceName).single());resources.services.push({id:service.id,wid:w.id,client:'owner'});save();
 for(let weekday=0;weekday<7;weekday++){const h=await ok(owner.client.from('professional_working_hours').insert({workspace_id:w.id,professional_member_id:member,weekday,start_time:'08:00',end_time:'18:00'}).select('id').single());resources.hours.push({id:h.id,wid:w.id,member,client:'owner'});save();}
 record('actual service form saves authoritative price duration and invited professional link; new availability persisted');
 const guest=make(),catalog=await ok(guest.rpc('list_public_booking_catalog',{p_slug:w.slug}));
 const pro=catalog.professionals.find(x=>x.id===member);assert.ok(pro);
 let day,slots;for(let n=3;n<=9;n++){day=new Date(Date.now()+n*86400000).toISOString().slice(0,10);slots=await ok(guest.rpc('list_public_available_slots',{p_slug:w.slug,p_service_id:service.id,p_professional_member_id:member,p_local_date:day}));if(slots.length>2)break;}assert.ok(slots.length>2);
 const chosen=slots[0].starts_at;
 const mobile=await browser.newContext({viewport:{width:390,height:844}}),clientPage=await mobile.newPage();debugPage=clientPage;clientPage.setDefaultTimeout(30000);
 phase='public_search';await clientPage.goto(origin+'/descobrir?modo=city&cidade=Juiz%20de%20Fora&uf=MG&q=agata%20pereira');
 const found=clientPage.locator(`ul a[href="/p/${w.slug}"]`);await found.waitFor();await found.click();await clientPage.getByRole('button',{name:'Agendar horário',exact:true}).first().click();
 await clientPage.getByRole('button',{name:new RegExp(serviceName)}).click();
 if(catalog.professionals.filter(x=>x.service_ids.includes(service.id)).length>1)await clientPage.getByRole('button',{name:'Escolher Ágata Pereira QA',exact:true}).click();
 const dateLabel=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,weekday:'long',day:'numeric',month:'long'}).format(new Date(day+'T15:00Z'));
 const timeLabel=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(chosen));
if(process.argv.includes('--network-probe')){
 phase='network_slots';let aborted=false;await mobile.route('**/*',async route=>{if(!aborted&&route.request().method()==='POST'&&route.request().headers()['next-action']){aborted=true;await route.abort('failed');}else await route.continue();});
 await clientPage.getByRole('button',{name:dateLabel,exact:true}).click();
 await clientPage.getByRole('alert').filter({hasText:'Não foi possível carregar os horários'}).waitFor({timeout:10000});
 await clientPage.getByRole('button',{name:'Tentar carregar horários novamente',exact:true}).click();
 await clientPage.getByRole('button',{name:timeLabel,exact:true}).waitFor();
 record('transport failure shows recoverable slot error without losing selection');

}else {await clientPage.getByRole('button',{name:dateLabel,exact:true}).click();}
const time=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(chosen));
 await clientPage.getByRole('button',{name:time,exact:true}).click();await clientPage.getByRole('button',{name:'Entrar para confirmar',exact:true}).click();await clientPage.waitForURL('**/login?next=**');
 const draft=(await mobile.cookies()).find(x=>x.name==='agende_booking_draft');assert.ok(draft?.httpOnly);const selection=JSON.parse(decodeURIComponent(draft.value)).selection;
 assert.equal(selection.serviceId,service.id);assert.equal(selection.professionalMemberId,member);assert.equal(Date.parse(selection.startsAt),Date.parse(chosen));
 assert.ok((await guest.rpc('create_public_appointment',{p_slug:w.slug,p_service_id:service.id,p_professional_member_id:member,p_starts_at:chosen,p_full_name:'Rejected anonymous',p_phone:customerE164,p_email:customer.email})).error);
 record('public professional search leads to exact selection and HttpOnly draft; available anonymous RPC denied');
 if(reuseConfirmed){await clientPage.locator('input[name=email]').fill(customer.email);await clientPage.locator('input[name=password]').fill(customer.password);await clientPage.getByRole('button',{name:'Entrar',exact:true}).click();await clientPage.waitForURL(`**/p/${w.slug}/agendar`);}
 else {
 phase='client_signup';await clientPage.getByRole('link',{name:/Criar conta/}).first().click();
 for(const [name,value]of Object.entries({fullName:'Cliente Jornada P0',email:customer.email,phone:customer.phone,password:customer.password,confirmPassword:customer.password}))await clientPage.locator(`input[name=${name}]`).fill(value);
 await clientPage.getByRole('checkbox').check();await clientPage.getByRole('button',{name:'Criar conta de cliente',exact:true}).click();await clientPage.waitForURL('**/verificar-email?status=sent');
 record('new client signs up from selected booking without losing draft');console.log('WAITING delivered booking client confirmation');
 const linkPath=process.argv.includes('--fresh-ui')?'.env.adv20-ui-booking-link.txt':'.env.adv20-booking-link.txt',deadline=Date.now()+15*60*1000;while(!existsSync(linkPath)){assert.ok(Date.now()<deadline,'delivered_email_unavailable');await new Promise(r=>setTimeout(r,1000));}
 const link=new URL(readFileSync(linkPath,'utf8').trim());assert.equal(link.origin,cfg.url);assert.equal(link.pathname,'/auth/v1/verify');assert.equal(new URL(link.searchParams.get('redirect_to')).origin,origin);
 await clientPage.goto(link.href);await clientPage.waitForURL(`**/p/${w.slug}/agendar`);
 }
 const resumed=JSON.parse(decodeURIComponent((await mobile.cookies()).find(x=>x.name==='agende_booking_draft').value)).selection;assert.deepEqual(resumed,selection);
 customerSession=await login(customer);customer.id=customerSession.user.id;writeFileSync(customerFile,JSON.stringify(customer));
 const before=await ok(customerSession.client.rpc('list_my_appointments'));assert.ok(before.every(x=>x.status==='cancelled'));assert.ok(!await clientPage.locator('input[name=fullName]').count()||await clientPage.locator('input[name=fullName]').isVisible());
 if(await clientPage.locator('input[name=fullName]').isVisible()){await clientPage.getByRole('button',{name:'Continuar',exact:true}).click();}
 record(reuseConfirmed?'previously SMTP-confirmed client login preserves new exact draft and creates no appointment':'delivered SMTP callback preserves exact booking selection in original PKCE browser and creates no appointment');
 phase='confirm_booking';
 if(process.argv.includes('--response-loss')){
  let dropped=false;await mobile.route('**/*',async route=>{if(!dropped&&route.request().method()==='POST'&&route.request().headers()['next-action']){dropped=true;await route.fetch();await route.abort('failed');}else await route.continue();});
  await clientPage.getByRole('button',{name:'Reservar este horário',exact:true}).click();
  await clientPage.getByRole('alert').filter({hasText:'Não foi possível confirmar a resposta'}).waitFor();
  assert.ok(await clientPage.getByRole('button',{name:'Reservar este horário',exact:true}).isDisabled());
  assert.equal(await clientPage.getByRole('heading',{name:/^Solicitação recebida!?$/,exact:true}).count(),0);
  await clientPage.getByRole('link',{name:'Conferir meus agendamentos',exact:true}).click();
  record('lost response after actual booking commit shows no false receipt blocks retry and links to persisted history');
 }else{await clientPage.getByRole('button',{name:'Reservar este horário',exact:true}).evaluate(el=>{el.click();el.click();});await clientPage.getByRole('heading',{name:/^Solicitação recebida!?$/,exact:true}).waitFor();}

 const history=await ok(customerSession.client.rpc('list_my_appointments'));const active=history.filter(x=>x.status!=='cancelled');assert.equal(active.length,1);const booking=active[0];assert.equal(booking.status,'scheduled');resources.appointments.push(booking.id);save();
 assert.equal((await ok(owner.client.from('appointments').select('created_by').eq('id',booking.id).single())).created_by,customerSession.user.id);
 if(!process.argv.includes('--response-loss'))assert.ok(!(await mobile.cookies()).some(x=>x.name==='agende_booking_draft'));
 await clientPage.reload();await clientPage.goto(origin+'/cliente/agendamentos');await clientPage.goBack();assert.equal((await ok(customerSession.client.rpc('list_my_appointments'))).filter(x=>x.id===booking.id).length,1);await clientPage.goto(origin+'/cliente/agendamentos');await clientPage.getByText(serviceName,{exact:true}).first().waitFor();record(process.argv.includes('--response-loss')?'lost response still persists exactly one booking and client history shows real state':'double click creates one authenticated scheduled booking; receipt and free client list show real state');
 phase='professional_whatsapp';await ok(owner.client.rpc('set_appointment_status',{p_appointment_id:booking.id,p_status:'confirmed'}));
 const proContext=await browser.newContext();await proContext.addCookies([...employee.jar].map(([name,value])=>({name,value,url:origin,httpOnly:true,sameSite:'Lax'})));
 const proPage=await proContext.newPage();debugPage=proPage;proPage.setDefaultTimeout(30000);await proPage.goto(`${origin}/app/agenda?date=${day}&professional=${member}`);
 await proPage.getByRole('button').filter({hasText:serviceName}).filter({hasText:'Confirmado'}).first().click();const dialog=proPage.getByRole('dialog');await dialog.waitFor();
 await dialog.getByText('Cliente Jornada P0',{exact:true}).first().waitFor();await dialog.getByText(customerDisplay,{exact:true}).waitFor();
 let target;await proContext.route(url=>url.pathname==='/api/appointments/whatsapp',async route=>{const response=await route.fetch({maxRedirects:0});assert.equal(response.status(),302);target=new URL(response.headers().location);assert.equal(target.origin,'https://wa.me');await route.fulfill({status:200,body:'Destino manual validado sem envio.',headers:{'content-type':'text/plain','cache-control':'private, no-store'}});});
 await dialog.getByRole('button',{name:'Confirmar pelo WhatsApp',exact:true}).click();for(let n=0;n<150&&!target;n++)await new Promise(r=>setTimeout(r,200));
 if(!target){const probe=await fetch(origin+'/api/appointments/whatsapp?id='+booking.id,{headers:employee.headers(),redirect:'manual'});writeFileSync('.env.adv20-whatsapp-probe.json',JSON.stringify({status:probe.status,location_host:probe.headers.get('location')?new URL(probe.headers.get('location')).host:null,popup_paths:proContext.pages().map(p=>{try{return new URL(p.url()).pathname;}catch{return 'pending';}})}));}
 assert.ok(target);assert.equal(target.pathname,'/'+customerE164.slice(1));const message=target.searchParams.get('text');assert.ok(message.includes('Olá, Cliente! 💗')&&message.includes(serviceName)&&message.includes('👤 Profissional: Ágata Pereira QA')&&message.includes('está confirmado!'));
 assert.equal((await ok(owner.client.from('appointments').select('status').eq('id',booking.id).single())).status,'confirmed');
 assert.ok((await foreign.client.rpc('get_appointment_whatsapp',{p_appointment_id:booking.id})).error);record('assigned professional actually opens manual WhatsApp link with authorized name phone and message; external navigation aborted and status unchanged');
 phase='reschedule';const next=slots.at(-1).starts_at;
 await clientPage.getByRole('button',{name:'Reagendar',exact:true}).first().click();const moveDialog=clientPage.getByRole('dialog');await moveDialog.getByLabel('Nova data').fill(day);
 const nextLabel=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(next));
 await moveDialog.getByRole('button',{name:nextLabel,exact:true}).click();await moveDialog.getByRole('button',{name:'Revisar alteração',exact:true}).click();await moveDialog.getByRole('button',{name:'Confirmar reagendamento',exact:true}).click();await moveDialog.waitFor({state:'hidden'});

 const moved=await ok(owner.client.from('appointments').select('starts_at,status,client_id').eq('id',booking.id).single());assert.equal(Date.parse(moved.starts_at),Date.parse(next));
 await clientPage.reload();await clientPage.getByText(serviceName,{exact:true}).first().waitFor();record('actual client reschedule dialog saves new time and persisted row matches the reloaded personal appointments');
 phase='global_avatar';const avatar=(method,body)=>fetch(origin+'/api/account/avatar',{method,body,headers:{...customerSession.headers(),origin}});
 assert.equal((await avatar('PUT',image)).status,200);avatarChanged=true;
 const firstAvatar=(await ok(customerSession.client.from('profiles').select('avatar_path').eq('user_id',customerSession.user.id).single())).avatar_path;
 const otherW=await ok(oldOwner.client.from('workspaces').select('id,name,slug').eq('id',old.workspaceId).single());const otherS=await ok(oldOwner.client.from('workspace_settings').select('*').eq('workspace_id',otherW.id).single());resources.settings.push({w:otherW,s:otherS,client:'old'});save();
 await ok(oldOwner.client.rpc('update_workspace_settings',settingsArgs(otherW,otherS,{p_city:'Muriaé',p_state:'MG'})));await ok(oldOwner.client.rpc('set_workspace_discovery',{p_workspace_id:otherW.id,p_enabled:true}));
 const otherMember=(await ok(oldOwner.client.from('workspace_members').select('id').eq('workspace_id',otherW.id).eq('user_id',oldOwner.user.id).single())).id;
 const otherService=await ok(oldOwner.client.rpc('save_service_with_professionals',{p_workspace_id:otherW.id,p_service_id:null,p_name:'Global avatar P0 '+Date.now(),p_description:null,p_duration_minutes:30,p_price_cents:5000,p_active:true,p_professional_member_ids:[otherMember]}));resources.services.push({id:otherService,wid:otherW.id,client:'old'});save();
 for(let weekday=0;weekday<7;weekday++){const h=await ok(oldOwner.client.from('professional_working_hours').insert({workspace_id:otherW.id,professional_member_id:otherMember,weekday,start_time:'08:00',end_time:'18:00'}).select('id').single());resources.hours.push({id:h.id,wid:otherW.id,member:otherMember,client:'old'});save();}
 const otherSlots=await ok(guest.rpc('list_public_available_slots',{p_slug:otherW.slug,p_service_id:otherService,p_professional_member_id:otherMember,p_local_date:day}));assert.ok(otherSlots.length);
 const second=await ok(customerSession.client.rpc('create_public_appointment',{p_slug:otherW.slug,p_service_id:otherService,p_professional_member_id:otherMember,p_starts_at:otherSlots[0].starts_at,p_full_name:'Cliente Jornada P0',p_phone:customerE164,p_email:customer.email}));resources.appointments.push(second.appointment_id);save();
 const secondRow=await ok(oldOwner.client.from('appointments').select('client_id').eq('id',second.appointment_id).single());
 const readAvatar=(actor,id)=>fetch(origin+'/api/clients/avatar?clientId='+id,{headers:actor.headers()});
 for(const [actor,id]of [[owner,moved.client_id],[oldOwner,secondRow.client_id]]){const r=await readAvatar(actor,id);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');}
 const nextImage=await sharp({create:{width:100,height:100,channels:3,background:'green'}}).png().toBuffer();assert.equal((await avatar('PUT',nextImage)).status,200);
 const hash=async r=>createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');assert.equal(await hash(await readAvatar(owner,moved.client_id)),await hash(await readAvatar(oldOwner,secondRow.client_id)));
 assert.equal((await readAvatar(foreign,moved.client_id)).status,404);assert.equal((await readAvatar(employee,secondRow.client_id)).status,404);assert.ok((await guest.storage.from('account-avatars').download(firstAvatar)).error);
 record('one optional global avatar and replacement bytes are shared across two legitimately linked establishments; unrelated tenant and professional denied');
 phase='cities';for(const [city,slug]of [['  MURIAE  ',otherW.slug],['  JUIZ   DE   FORA  ',w.slug]]){const found=await ok(guest.rpc('search_public_workspaces',{p_city:city,p_state:'MG',p_query:null}));assert.ok(found.items.some(x=>x.slug===slug));}
 for(const query of ['agata pereira','ÁGATA   PEREIRA']){const found=await ok(guest.rpc('search_public_workspaces',{p_city:'Juiz de Fora',p_state:'MG',p_query:query}));assert.ok(found.items.some(x=>x.slug===w.slug));}
 const wrong=await ok(guest.rpc('search_public_workspaces',{p_city:'Muriaé',p_state:'MG',p_query:'Ágata Pereira'}));assert.ok(!wrong.items.some(x=>x.slug===w.slug));
 await clientPage.goto(origin+'/descobrir?modo=city&cidade=Muria%C3%A9&uf=MG');await clientPage.locator(`ul a[href="/p/${otherW.slug}"]`).waitFor();
 await clientPage.goto(origin+'/descobrir?modo=city&cidade=Juiz%20de%20Fora&uf=MG&q=agata%20pereira');await clientPage.locator(`ul a[href="/p/${w.slug}"]`).waitFor();
 await clientPage.screenshot({path:'docs/homologation/adv20-integrated-discovery.png',fullPage:true});record('actual controlled fixtures found in Muriaé and Juiz de Fora; establishment and professional query handles accents case spaces and combined city');
 phase='cancel';await clientPage.goto(origin+'/cliente/agendamentos');
 await clientPage.getByRole('button',{name:'Desmarcar',exact:true}).first().click();const cancelDialog=clientPage.getByRole('dialog');await cancelDialog.getByRole('button',{name:'Confirmar cancelamento',exact:true}).click();await cancelDialog.waitFor({state:'hidden'});
 for(const id of resources.appointments){const row=(await ok(customerSession.client.rpc('list_my_appointments'))).find(x=>x.id===id);if(row.status!=='cancelled')await ok(customerSession.client.rpc('cancel_my_appointment',{p_appointment_id:id}));}
 record('actual client cancellation dialog persists a cancelled appointment before synthetic cleanup');

 const denied=await fetch(origin+'/api/appointments/whatsapp?id='+booking.id,{headers:employee.headers(),redirect:'manual'});assert.equal(denied.status,422);assert.equal(denied.headers.get('location'),null);
 record('client cancellations preserve history and cancelled booking cannot expose a WhatsApp confirmation');
}catch(error){writeFileSync('.env.adv20-journey-error.txt',String(error.stack));if(debugPage)await debugPage.screenshot({path:'.env.adv20-journey-failure.png',fullPage:true}).catch(()=>{});checks.push({name:phase,status:'FAIL',code:error.name});process.exitCode=1;}
finally{
 const cleanup=async(name,fn)=>{try{await fn();}catch{checks.push({name:'cleanup '+name,status:'FAIL'});process.exitCode=1;}};
 if(customerSession)for(const id of resources.appointments)await cleanup('appointment',async()=>{const row=(await ok(customerSession.client.rpc('list_my_appointments'))).find(x=>x.id===id);if(row&&row.status!=='cancelled')await ok(customerSession.client.rpc('cancel_my_appointment',{p_appointment_id:id}));});
 if(avatarChanged)await cleanup('avatar',async()=>assert.equal((await fetch(origin+'/api/account/avatar',{method:'DELETE',headers:{...customerSession.headers(),origin}})).status,200));
 if(photoChanged)await cleanup('professional photo',async()=>assert.equal((await fetch(origin+'/api/professionals/photo?memberId='+member,{method:'DELETE',headers:{...owner.headers(),origin}})).status,200));
 for(const row of resources.services)await cleanup('own service',()=>ok((row.client==='old'?oldOwner:owner).client.from('services').update({active:false,archived_at:new Date().toISOString()}).eq('id',row.id).eq('workspace_id',row.wid)));
 for(const row of resources.hours)await cleanup('own hours',()=>ok((row.client==='old'?oldOwner:owner).client.from('professional_working_hours').delete().eq('id',row.id).eq('workspace_id',row.wid).eq('professional_member_id',row.member)));
 for(const row of resources.settings)await cleanup('settings',async()=>{const actor=row.client==='old'?oldOwner:owner;await ok(actor.client.rpc('update_workspace_settings',settingsArgs(row.w,row.s)));await ok(actor.client.rpc('set_workspace_discovery',{p_workspace_id:row.w.id,p_enabled:row.s.discovery_enabled}));});
 resources.cleanup_finished_at=new Date().toISOString();save();report();await browser?.close();server.kill();
}
