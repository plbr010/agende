// Real UI -> SSR signup -> delivered SMTP link -> callback -> reservation.
// Only authorized synthetic Gmail aliases on staging; no administrative confirmation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID,randomInt} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const origin='http://localhost:3000',slug='staging-studio-a',checks=[];
const fresh=()=>createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const client=fresh(),owner=fresh(),professionalClient=fresh();
const ok=async promise=>{const r=await promise;assert.equal(r.error,null,'Backend operation failed');return r.data;};
const mailbox=process.env.AGENDE_STAGING_MAILBOX?.trim().toLowerCase();
assert.ok(mailbox&&/^[^@\s+]+@gmail\.com$/.test(mailbox),'Authorized AGENDE_STAGING_MAILBOX required');
const [mailLocal,mailDomain]=mailbox.split('@');
const fixtures={client:{email:`${mailLocal}+agende-stab-jornada@${mailDomain}`,password:randomUUID()+'aA1!',phone:'329'+randomInt(10000000,99999999)},
 professional:{email:`${mailLocal}+agende-stab-pro2@${mailDomain}`,password:randomUUID()+'aA1!',phone:'329'+randomInt(10000000,99999999)}};
const privateState='.env.stabilization-browser-fixtures.json';assert.ok(!existsSync(privateState),'Never replace an existing acceptance context');
writeFileSync(privateState,JSON.stringify(fixtures));
const report=()=>writeFileSync('docs/staging/stabilization-signup-booking-browser.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',mode:'real browser + SSR actions + delivered email links + staging GoTrue/PostgREST',production_touched:false,checks},null,2)+'\n');
const record=(name,status='PASS')=>{checks.push({name,status});report();console.log(status+' '+name);};
const waitLink=async intent=>{const path=`.env.stabilization-browser-link-${intent}.txt`,until=Date.now()+15*60*1000;
 console.log('WAITING actual delivered '+intent+' email link');
 while(!existsSync(path)){assert.ok(Date.now()<until,'Actual delivered email link unavailable');await new Promise(r=>setTimeout(r,1000));}
 const link=new URL(readFileSync(path,'utf8').trim());assert.equal(link.origin,config.url);assert.equal(link.pathname,'/auth/v1/verify');return link.href;
};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{windowsHide:true,stdio:'ignore',env:{...process.env,SITE_URL:origin,NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key}});
let browser,appointment;
try {
 for(let n=0;n<60;n++){try{await fetch(origin+'/login');break;}catch{}await new Promise(r=>setTimeout(r,250));}
 const catalog=await ok(client.rpc('list_public_booking_catalog',{p_slug:slug}));
 const service=catalog.services[0],person=catalog.professionals.find(p=>p.service_ids?.includes(service.id));assert.ok(person);
 let day,slots;
 for(let n=2;n<=8;n++){const date=new Date(Date.now()+n*86400000).toISOString().slice(0,10);
  const found=await ok(client.rpc('list_public_available_slots',{p_slug:slug,p_service_id:service.id,p_professional_member_id:person.id,p_local_date:date}));
  if(found.length){day=date;slots=found;break;}}
 assert.ok(day);browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(25000);
 await page.goto(origin+`/p/${slug}/agendar?servico=${service.id}`);
 if(catalog.professionals.filter(p=>p.service_ids?.includes(service.id)).length>1)await page.getByRole('button',{name:new RegExp(person.display_name)}).first().click();
 const dateLabel=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,weekday:'long',day:'numeric',month:'long'}).format(new Date(day+'T15:00Z'));
 await page.getByRole('button',{name:dateLabel,exact:true}).click();
 const label=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(slots[0].starts_at));
 await page.getByRole('button',{name:label,exact:true}).click();await page.waitForURL('**/login?next=**');
 const draft=(await context.cookies()).find(c=>c.name==='agende_booking_draft');assert.ok(draft?.httpOnly);
 const selection=JSON.parse(decodeURIComponent(draft.value)).selection;assert.equal(selection.serviceId,service.id);
 record('salon service professional date and slot selected before signup; draft is HttpOnly');
 await page.getByRole('link',{name:/Criar conta/}).click();
 const signup=async(p,intent)=>{const f=fixtures[intent];
  await p.locator('#signup-intent-'+intent).click();
  for(const [name,value] of Object.entries({fullName:'Stabilization '+intent,email:f.email,phone:f.phone,password:f.password,confirmPassword:f.password}))await p.locator(`input[name=${name}]`).fill(value);
  await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Criar minha conta',exact:true}).click();
  await p.waitForURL('**/verificar-email?status=sent');record(intent+' actual signup form accepted; SMTP confirmation requested');
 };
 await signup(page,'client');
 const proContext=await browser.newContext(),proPage=await proContext.newPage();proPage.setDefaultTimeout(25000);
 await proPage.goto(origin+'/cadastro?intent=professional');await signup(proPage,'professional');
 await page.goto(await waitLink('client'));await page.waitForURL(`**/p/${slug}/agendar`);
 assert.ok((await context.cookies()).some(c=>c.name.startsWith('sb-fkpdudnnperufnmdwdlv-auth-token')));
 const resumed=JSON.parse(decodeURIComponent((await context.cookies()).find(c=>c.name==='agende_booking_draft').value)).selection;
 assert.deepEqual(resumed,selection);record('delivered client email callback preserves exact original booking selection in same browser');
 const available=await ok(client.rpc('list_public_available_slots',{p_slug:slug,p_service_id:service.id,p_professional_member_id:person.id,p_local_date:day}));
 assert.ok(available.some(s=>s.starts_at===selection.startsAt),'Selected slot became unavailable during email confirmation');
 const details=page.locator('input[name=fullName]');
 if(await details.count()) {
  for(const [name,value] of Object.entries({fullName:'Stabilization client',phone:fixtures.client.phone,email:fixtures.client.email}))await page.locator(`input[name=${name}]`).fill(value);
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
 }
 await page.getByRole('button',{name:'Reservar este horário',exact:true}).click();
 await page.getByRole('heading',{name:'Solicitação recebida',exact:true}).waitFor();
 assert.ok(!(await context.cookies()).some(c=>c.name==='agende_booking_draft'));record('reservation confirmed by UI after email callback; draft cleared');
 await ok(client.auth.signInWithPassword(fixtures.client));
 const rows=await ok(client.rpc('list_my_appointments'));
 const matching=rows.filter(r=>r.service_id===service.id&&new Date(r.starts_at).getTime()===new Date(selection.startsAt).getTime());assert.equal(matching.length,1);appointment=matching[0].id;
 const duplicate=await client.rpc('create_public_appointment',{p_slug:slug,p_service_id:service.id,p_professional_member_id:person.id,p_starts_at:selection.startsAt,p_full_name:'Stabilization client',p_phone:fixtures.client.phone,p_email:fixtures.client.email,p_customer_note:null,p_ip_hash:'stabilization-jornada-'+randomUUID()});assert.ok(duplicate.error);
 assert.equal((await ok(client.rpc('list_my_appointments'))).filter(r=>r.service_id===service.id&&new Date(r.starts_at).getTime()===new Date(selection.startsAt).getTime()).length,1);
 await ok(owner.auth.signInWithPassword({email:'owner-a@agende-staging.invalid',password:config.fixture_password}));
 assert.equal((await ok(owner.from('appointments').select('id').eq('id',appointment))).length,1);record('one persistent appointment visible to customer and salon; duplicate denied');
 await proPage.goto(await waitLink('professional'));await proPage.waitForURL('**/onboarding');
 await ok(professionalClient.auth.signInWithPassword(fixtures.professional));
 assert.equal((await ok(professionalClient.rpc('list_my_appointments'))).some(r=>r.id===appointment),false);record('professional delivered email callback lands on onboarding; customer reservation isolated');
 await ok(client.rpc('cancel_my_appointment',{p_appointment_id:appointment}));appointment=null;record('synthetic reservation cancelled through authorized RPC; history retained');
} catch(e) {
 let message=String(e.message);for(const f of Object.values(fixtures))message=message.replaceAll(f.password,'[redacted]');
 message=message.replace(/(token|code|token_hash)=[^&\s]+/g,'$1=[redacted]');
 checks.push({name:'new account signup and booking acceptance',status:'FAIL',error:message.slice(0,500)});report();console.log('FAIL new account signup and booking acceptance');process.exitCode=1;
} finally {
 if(appointment)try{await ok(client.rpc('cancel_my_appointment',{p_appointment_id:appointment}));}catch{record('synthetic reservation cancellation failed','FAIL');}
 await browser?.close();server.kill();report();
}
