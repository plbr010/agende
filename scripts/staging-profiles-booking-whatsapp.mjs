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
const checks=[];let browser,owner,memberId,photoChanged=false,bookingCustomer,bookingId;
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);};
const login=async(prefix)=>{
 const jar=new Map();const client=createServerClient(config.url,config.publishable_key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
 const {data,error}=await client.auth.signInWithPassword({email:prefix+'@agende-staging.invalid',password:config.fixture_password});assert.equal(error?.code,undefined,'fixture authentication failed');
 return {client,user:data.user,jar,header:()=>[...jar].map(([n,v])=>`${n}=${v}`).join('; ')};
};
const photo=(session,method='GET',body,extra={})=>fetch(`${origin}/api/professionals/photo?memberId=${memberId}`,{method,body,headers:{...(session?{cookie:session.header()}:{}),...(method==='GET'?{}:{origin}),...extra}});
try {
 for(let n=0;n<80;n++){try{if((await fetch(origin+'/api/account/avatar')).status===401)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 owner=await login('owner-a');const foreign=await login('owner-b');
 const {data:member,error}=await owner.client.from('workspace_members').select('id,workspace_id').eq('user_id',owner.user.id).eq('status','active').limit(1).single();assert.equal(error,null);memberId=member.id;
 const current=await owner.client.from('professional_profiles').select('photo_path,display_name').eq('member_id',memberId).single();assert.equal(current.error,null);assert.equal(current.data.photo_path,null,'never replace an existing photo');
 await check('real PostgREST rejects anonymous booking and direct privileged photo mutations',async()=>{
   const anon=createClient(config.url,config.publishable_key,{auth:{persistSession:false}});
   assert.ok((await anon.rpc('create_public_appointment',{p_slug:'missing',p_service_id:memberId,p_professional_member_id:memberId,p_starts_at:new Date().toISOString(),p_full_name:'Synthetic',p_phone:'+5532999999999',p_email:'synthetic@invalid.test'})).error);
   assert.ok((await owner.client.rpc('swap_professional_photo',{p_actor_id:owner.user.id,p_member_id:memberId,p_expected_path:null,p_new_path:null})).error);
 });
 await check('HTTP rejects foreign professional edit, anonymous private read, CSRF and dangerous bytes',async()=>{
   assert.equal((await photo(foreign,'DELETE')).status,404);
   assert.equal((await photo(null)).status,404);
   assert.equal((await photo(owner,'DELETE',undefined,{origin:'https://foreign.invalid'})).status,403);
   assert.equal((await photo(owner,'PUT',Buffer.from('MZ executable.jpg'),{'content-type':'image/jpeg','x-image-extension':'jpg','x-public-photo-consent':'true'})).status,422);
 });
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext();await context.addCookies([...owner.jar].map(([name,value])=>({name,value,url:origin,httpOnly:true,sameSite:'Lax'})));
 const page=await context.newPage();page.setDefaultTimeout(30000);
 await page.goto(origin+'/app/equipe');
 const editor=page.getByRole('region',{name:`Foto de ${current.data.display_name}`}).first();
 await editor.waitFor();
 const first=await sharp({create:{width:160,height:120,channels:3,background:'blue'}}).jpeg().withMetadata().toBuffer();
 await check('browser upload, actual Storage bytes and reload render the persisted professional photo',async()=>{
   await editor.locator('input[type=file]').setInputFiles({name:'synthetic.jpg',mimeType:'image/jpeg',buffer:first});photoChanged=true;
   await editor.getByRole('status').filter({hasText:'Foto salva.'}).waitFor();
   let img=editor.locator('img');await img.waitFor();assert.ok(await img.evaluate(el=>el.decode().then(()=>el.naturalWidth>0).catch(()=>false)));
   await page.reload();await editor.locator('img').waitFor();assert.ok(await editor.locator('img').evaluate(el=>el.decode().then(()=>el.naturalWidth>0).catch(()=>false)));
   await page.screenshot({path:'docs/homologation/professional-photo-staging-20261016.png',fullPage:true});
   const response=await photo(owner);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
   const metadata=await sharp(Buffer.from(await response.arrayBuffer())).metadata();assert.equal(metadata.format,'webp');assert.equal(metadata.exif,undefined);
 });
 const firstPath=(await owner.client.from('professional_profiles').select('photo_path').eq('member_id',memberId).single()).data.photo_path;
 await check('browser replacement reaps old bytes, remains private and survives reload',async()=>{
   const next=await sharp({create:{width:120,height:120,channels:3,background:'green'}}).png().toBuffer();
   await Promise.all([page.waitForResponse(r=>r.url().includes('/api/professionals/photo')&&r.request().method()==='PUT'&&r.status()===200),editor.locator('input[type=file]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:next})]);
   await page.reload();await editor.locator('img').waitFor();
   const row=(await owner.client.from('professional_profiles').select('photo_path').eq('member_id',memberId).single()).data;
   assert.notEqual(row.photo_path,firstPath);
   const listing=await admin.storage.from('professional-photos').list(`${member.workspace_id}/professionals/${memberId}`);assert.equal(listing.error,null);assert.ok(!listing.data.some(file=>file.name===firstPath.split('/').at(-1))); // CDN may briefly retain cached bytes; the route never serves superseded references.
   assert.ok((await foreign.client.storage.from('professional-photos').download(row.photo_path)).error);
   assert.ok((await foreign.client.storage.from('professional-photos').createSignedUrl(row.photo_path,60)).error);
 });
 await check('public chooser serves the correct professional photo with the same normalized bytes',async()=>{
   const workspace=(await owner.client.from('workspaces').select('slug').eq('id',member.workspace_id).single()).data;
   const catalog=await owner.client.rpc('list_public_booking_catalog',{p_slug:workspace.slug});assert.equal(catalog.error,null);
   assert.ok(catalog.data.professionals.some(person=>person.id===memberId),'fixture professional must be publicly bookable');
   const privateRead=await photo(owner);const publicRead=await fetch(`${origin}/api/professionals/photo?memberId=${memberId}&slug=${workspace.slug}`);
   assert.equal(publicRead.status,200);assert.deepEqual(Buffer.from(await publicRead.arrayBuffer()),Buffer.from(await privateRead.arrayBuffer()));
 });
 await check('manual WhatsApp reads pending, confirmed, rescheduled and cancelled state through real HTTP without sending or mutating it',async()=>{
   const workspace=(await owner.client.from('workspaces').select('slug').eq('id',member.workspace_id).single()).data;
   const catalog=(await owner.client.rpc('list_public_booking_catalog',{p_slug:workspace.slug})).data;
   const person=catalog.professionals.find(person=>person.id===memberId);const serviceId=person.service_ids[0];assert.ok(serviceId);
   let day,slots;
   for(let n=10;n<=16;n++){
     day=new Date(Date.now()+n*86400000).toISOString().slice(0,10);
     const found=await owner.client.rpc('list_public_available_slots',{p_slug:workspace.slug,p_service_id:serviceId,p_professional_member_id:memberId,p_local_date:day});
     if(found.data?.length>2){slots=found.data;break;}
   }
   assert.ok(slots?.length>2,'fixture availability required');
   bookingCustomer=await login('client');
   const created=await bookingCustomer.client.rpc('create_public_appointment',{p_slug:workspace.slug,p_service_id:serviceId,p_professional_member_id:memberId,p_starts_at:slots[0].starts_at,p_full_name:'Cliente sintético WhatsApp',p_phone:'+5532999999999',p_email:bookingCustomer.user.email,p_customer_note:'Synthetic profiles WhatsApp acceptance 20261016'});
   assert.equal(created.error,null);bookingId=created.data.appointment_id;
   const read=async()=>{
     const before=(await owner.client.from('appointments').select('status,starts_at').eq('id',bookingId).single()).data;
     const response=await fetch(`${origin}/api/appointments/whatsapp?id=${bookingId}`,{headers:{cookie:owner.header()},redirect:'manual'});
     const after=(await owner.client.from('appointments').select('status,starts_at').eq('id',bookingId).single()).data;
     assert.deepEqual(after,before);return response;
   };
   let response=await read();assert.equal(response.status,302);
   assert.match(new URL(response.headers.get('location')).searchParams.get('text'),/ainda aguarda confirmação/);
   const confirmed=await owner.client.rpc('set_appointment_status',{p_appointment_id:bookingId,p_status:'confirmed'});assert.equal(confirmed.error,null);
   response=await read();assert.equal(response.status,302);
   assert.match(new URL(response.headers.get('location')).searchParams.get('text'),/está confirmado!/);
   const moved=await bookingCustomer.client.rpc('reschedule_my_appointment',{p_appointment_id:bookingId,p_professional_member_id:memberId,p_starts_at:slots.at(-1).starts_at});assert.equal(moved.error,null);
   response=await read();assert.equal(response.status,302);
   const time=new Intl.DateTimeFormat('pt-BR',{timeZone:catalog.timezone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(slots.at(-1).starts_at));
   assert.ok(new URL(response.headers.get('location')).searchParams.get('text').includes(time));
   const cancelled=await bookingCustomer.client.rpc('cancel_my_appointment',{p_appointment_id:bookingId});assert.equal(cancelled.error,null);bookingId=null;
   // Check the cancelled appointment using the original ID: no redirect/message.
   const denied=await fetch(`${origin}/api/appointments/whatsapp?id=${created.data.appointment_id}`,{headers:{cookie:owner.header()},redirect:'manual'});
   assert.equal(denied.status,422);assert.equal(denied.headers.get('location'),null);
 });
 await check('manual WhatsApp endpoint refuses foreign or missing appointment without navigating to WhatsApp',async()=>{
   const r=await fetch(`${origin}/api/appointments/whatsapp?id=${memberId}`,{headers:{cookie:foreign.header()},redirect:'manual'});
   assert.equal(r.status,422);assert.equal(r.headers.get('location'),null);assert.equal(r.headers.get('cache-control'),'private, no-store');
 });
 await check('browser removal restores initials and deletes only the newly created synthetic photo',async()=>{
   await editor.getByRole('button',{name:'Remover foto'}).click();await editor.getByRole('status').filter({hasText:'Foto removida.'}).waitFor();photoChanged=false;
   await page.reload();assert.equal(await editor.locator('img').count(),0);
   await page.screenshot({path:'docs/homologation/professional-photo-removed-staging-20261016.png',fullPage:true});
   assert.equal((await owner.client.from('professional_profiles').select('photo_path').eq('member_id',memberId).single()).data.photo_path,null);
   const listing=await admin.storage.from('professional-photos').list(`${member.workspace_id}/professionals/${memberId}`);assert.equal(listing.error,null);assert.equal(listing.data.length,0);
 });
} catch(error) {
 checks.push({name:'staging integrated acceptance',status:'FAIL',error:String(error.message).slice(0,400)});process.exitCode=1;console.log('FAIL staging integrated acceptance');
} finally {
 if(bookingId&&bookingCustomer){const cancelled=await bookingCustomer.client.rpc('cancel_my_appointment',{p_appointment_id:bookingId});checks.push({name:'cancel own synthetic appointment',status:cancelled.error?'FAIL':'PASS'});if(cancelled.error)process.exitCode=1;}
 if(photoChanged&&owner&&memberId){const r=await photo(owner,'DELETE');checks.push({name:'cleanup own synthetic photo',status:r.ok?'PASS':'FAIL'});if(!r.ok)process.exitCode=1;}
 await browser?.close();server.kill();
 writeFileSync('docs/homologation/profiles-booking-staging-20261016.json',JSON.stringify({checked_at:new Date().toISOString(),project,production_writes:0,mode:'real GoTrue, PostgREST, Storage, local Next and Edge browser',checks},null,2)+'\n');
}
