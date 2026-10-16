import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const config=JSON.parse(readFileSync(process.env.AGENDE_PHASE2_CONFIG_FILE??'.env.staging-homologation.json','utf8'));
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const client=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=async p=>{const r=await p;assert.equal(r.error,null,r.error?.message);return r.data;};
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const origin=`http://127.0.0.1:${port}`,checks=[];
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{windowsHide:true,stdio:'ignore',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key,NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV:'staging',NEXT_PUBLIC_SITE_URL:origin}});
let browser,blocker,blockerOwner;
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS',mode:'real browser + local Next + staging GoTrue/PostgREST'});console.log('PASS '+name);};
try{
 for(let n=0;n<40;n++){try{if((await fetch(origin+'/api/account/avatar')).status===401)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 const slug='staging-studio-a';const catalog=await ok(client.rpc('list_public_booking_catalog',{p_slug:slug}));
 const service=catalog.services[0],professional=catalog.professionals.find(p=>p.service_ids?.includes(service.id)||p.offerings?.some(o=>o.service_id===service.id));assert.ok(professional);
 let day,slots;
 for(let n=2;n<=8;n++){
  const date=new Date(Date.now()+n*86400000).toISOString().slice(0,10);
  const found=await ok(client.rpc('list_public_available_slots',{p_slug:slug,p_service_id:service.id,p_professional_member_id:professional.id??professional.member_id,p_local_date:date}));
  if(found.length){day=date;slots=found;break;}
 }
 assert.ok(day);assert.ok(slots.length);
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(20000);
 await check('anonymous selection redirects to login carrying only HttpOnly short-lived draft',async()=>{
  await page.goto(origin+`/p/${slug}/agendar?servico=${service.id}`);
  const dateLabel=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,weekday:'long',day:'numeric',month:'long'}).format(new Date(day+'T15:00:00Z'));
  const people=catalog.professionals.filter(p=>p.service_ids?.includes(service.id));
  if(people.length>1)await page.getByRole('button',{name:new RegExp(professional.display_name)}).first().click();
  await page.getByRole('button',{name:dateLabel,exact:true}).waitFor();
  await page.getByRole('button',{name:dateLabel,exact:true}).click();
  const label=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(slots[0].starts_at));
  await page.getByRole('button',{name:label,exact:true}).click();await page.waitForURL('**/login?next=**');
  const draft=(await context.cookies()).find(c=>c.name==='agende_booking_draft');assert.ok(draft?.httpOnly);assert.equal(draft.sameSite,'Lax');
  const value=JSON.parse(decodeURIComponent(draft.value));assert.equal(value.selection.serviceId,service.id);assert.equal(value.selection.localDate,day);
  assert.deepEqual(Object.keys(value.selection).sort(),['slug','serviceId','professionalMemberId','localDate','startsAt'].sort());
  assert.ok(await page.getByRole('link',{name:/Criar conta/}).count());
 });
 await check('actual login returns to selected salon service professional date and slot',async()=>{
  await page.locator('input[name=email]').fill('client@agende-staging.invalid');await page.locator('input[name=password]').fill(config.fixture_password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(`**/p/${slug}/agendar`);
  const current=page.locator('[aria-current=step]');await current.waitFor();
  const stepText=await current.locator('..').innerText();
  assert.ok(['Confirmar','Seus dados'].some(x=>stepText.includes(x)),stepText);
  const draft=(await context.cookies()).find(c=>c.name==='agende_booking_draft');assert.equal(JSON.parse(decodeURIComponent(draft.value)).selection.serviceId,service.id);
  await page.screenshot({path:'docs/staging/client-phase2-booking-resumed-mobile.png',fullPage:true});
 });
 await check('slot occupied during login preserves service professional and day and requires another slot',async()=>{
  const fresh=await browser.newContext({viewport:{width:390,height:844}}),page2=await fresh.newPage();page2.setDefaultTimeout(20000);
  await page2.goto(origin+`/p/${slug}/agendar?servico=${service.id}`);
  const dateLabel=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,weekday:'long',day:'numeric',month:'long'}).format(new Date(day+'T15:00:00Z'));
  if(catalog.professionals.filter(p=>p.service_ids?.includes(service.id)).length>1)await page2.getByRole('button',{name:new RegExp(professional.display_name)}).first().click();
  await page2.getByRole('button',{name:dateLabel,exact:true}).click();
  const label=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(slots[0].starts_at));
  await page2.getByRole('button',{name:label,exact:true}).click();await page2.waitForURL('**/login?next=**');
  const selection=JSON.parse(decodeURIComponent((await fresh.cookies()).find(c=>c.name==='agende_booking_draft').value)).selection;
  blockerOwner=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
  await ok(blockerOwner.auth.signInWithPassword({email:'owner-a@agende-staging.invalid',password:config.fixture_password}));
  const w=(await ok(blockerOwner.from('workspaces').select('id').eq('slug',slug)))[0];
  const customer=(await ok(blockerOwner.from('workspace_clients').select('id').eq('workspace_id',w.id).limit(1)))[0];assert.ok(customer);
  blocker=await ok(blockerOwner.rpc('create_appointment',{p_workspace_id:w.id,p_client_id:customer.id,p_professional_member_id:professional.id,p_service_id:service.id,p_starts_at:selection.startsAt,p_notes:'Synthetic phase2 login revalidation test'}));
  await page2.locator('input[name=email]').fill('client@agende-staging.invalid');await page2.locator('input[name=password]').fill(config.fixture_password);
  await page2.getByRole('button',{name:'Entrar',exact:true}).click();await page2.waitForURL(`**/p/${slug}/agendar`);
  await page2.getByText('Esse horário foi ocupado enquanto você entrava. Escolha outro.',{exact:true}).waitFor();
  assert.ok((await page2.locator('[aria-current=step]').locator('..').innerText()).includes('Horário'));
  const preserved=JSON.parse(decodeURIComponent((await fresh.cookies()).find(c=>c.name==='agende_booking_draft').value)).selection;
  assert.equal(preserved.serviceId,selection.serviceId);assert.equal(preserved.professionalMemberId,selection.professionalMemberId);assert.equal(preserved.localDate,selection.localDate);
  const available=page2.locator('section[aria-label="Escolher horário"]').getByRole('button');
  await available.first().waitFor();assert.equal(await available.filter({hasText:label}).count(),0);
  await page2.screenshot({path:'docs/staging/client-phase2-slot-revalidated-mobile.png',fullPage:true});
 });
}catch(e){checks.push({name:'booking browser acceptance',status:'FAIL',error:String(e.message).replaceAll(config.fixture_password,'[redacted]').slice(0,500)});process.exitCode=1;console.log('FAIL booking browser acceptance');}
finally{
 if(blocker&&blockerOwner)try{await ok(blockerOwner.rpc('set_appointment_status',{p_appointment_id:blocker,p_status:'cancelled'}));}catch{checks.push({name:'cancel synthetic blocker',status:'FAIL'});process.exitCode=1;}
 await browser?.close();server.kill();writeFileSync('docs/staging/client-phase2-booking-browser.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',production_touched:false,checks},null,2)+'\n');
}
