import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

test('profiles booking WhatsApp SQL: authenticated booking, photos, tenant and role boundaries', async t => {
 const db=await createLocalDatabase(); t.after(()=>db.close());
 await db.exec(readFileSync('supabase/tests/helpers.sql','utf8'));
 const user=async(name,intent='professional',confirmed=true)=>(await db.query('select test_helpers.create_auth_user($1,$2,$3) id',[name+'@mission.invalid',intent,confirmed])).rows[0].id;
 const owner=await user('owner'),other=await user('other'),customer=await user('customer','client'),unconfirmed=await user('unconfirmed','client',false),pro=await user('pro'),reception=await user('reception');
 const as=(uid,sql,args=[],role=uid?'authenticated':'anon')=>db.transaction(async tx=>{
   await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[uid??'',role]);
   await tx.exec('set local role '+role);return tx.query(sql,args);
 });
 const ws=(await as(owner,"select public.create_workspace('Mission Salon',null,'equipe') data")).rows[0].data.workspace_id;
 const foreign=(await as(other,"select public.create_workspace('Other Salon',null,'equipe') data")).rows[0].data.workspace_id;
 const member=(await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2',[ws,owner])).rows[0].id;
 const foreignMember=(await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2',[foreign,other])).rows[0].id;
 const proMember=(await db.query("insert into public.workspace_members(workspace_id,user_id,role,status) values($1,$2,'professional','active') returning id",[ws,pro])).rows[0].id;
 await db.query("insert into public.workspace_members(workspace_id,user_id,role,status) values($1,$2,'receptionist','active')",[ws,reception]);
 const slug=(await db.query('select slug from public.workspaces where id=$1',[ws])).rows[0].slug;
 const service=(await as(owner,"insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Corte',60,8000) returning id",[ws])).rows[0].id;
 await as(owner,'insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)',[ws,member,service]);
 await as(owner,"insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6) n",[ws,member]);
 const start=(await db.query("select (((clock_timestamp() at time zone 'America/Sao_Paulo')::date+3)+time '10:00') at time zone 'America/Sao_Paulo' s")).rows[0].s;
 const book='select public.create_public_appointment($1,$2,$3,$4,\'Maria\',\'+5532999999999\',\'spoofed@mission.invalid\') data';
 const args=[slug,service,member,start]; let appointment,clientId;
 await t.test('anonymous RPC revoked and unconfirmed account denied before any writes; public browsing remains open',async()=>{
   await assert.rejects(as(null,book,args),/permission denied/);
   await assert.rejects(as(unconfirmed,book,args),/email_not_confirmed/);
   await assert.rejects(as(null,'select app.create_public_appointment($1,$2,$3,$4,\'Maria\',\'+5532999999999\',\'spoofed@mission.invalid\')',args,'service_role'),/not_authenticated/);
   assert.equal((await db.query('select count(*)::int n from public.appointments')).rows[0].n,0);
   assert.ok((await as(null,'select public.list_public_booking_catalog($1) data',[slug])).rows[0].data.professionals.some(p=>p.id===member));
 });
 await t.test('authenticated booking uses verified identity, authoritative price; repeats and cross-tenant IDs cannot duplicate',async()=>{
   const receipt=(await as(customer,book,args)).rows[0].data;appointment=receipt.appointment_id;
   const row=(await db.query('select * from public.appointments where id=$1',[appointment])).rows[0];clientId=row.client_id;
   assert.equal(row.price_cents,8000);assert.equal(row.created_by,customer);
   assert.equal((await db.query('select linked_user_id,email from public.workspace_clients where id=$1',[clientId])).rows[0].linked_user_id,customer);
   await assert.rejects(as(customer,book,args),/slot_taken|overlap|duplicate/);
   await assert.rejects(as(customer,book,[slug,service,foreignMember,start]),/professional|not_found|slot/);
   assert.equal((await db.query('select count(*)::int n from public.appointments')).rows[0].n,1);
 });
 await t.test('WhatsApp returns latest data only to authorized team; clients and unrelated professionals/tenants cannot read',async()=>{
   for(const actor of [customer,other,pro]) await assert.rejects(as(actor,'select public.get_appointment_whatsapp($1)',[appointment]),/appointment_unavailable/);
   await assert.rejects(as(null,'select public.get_appointment_whatsapp($1)',[appointment]),/permission denied/);
   const result=(await as(reception,'select public.get_appointment_whatsapp($1) data',[appointment])).rows[0].data;
   assert.equal(result.status,'scheduled');assert.equal(result.phone,'+5532999999999');assert.equal(result.timezone,'America/Sao_Paulo');
   await as(owner,"select public.set_appointment_status($1,'confirmed')",[appointment]);
   assert.equal((await as(owner,'select public.get_appointment_whatsapp($1) data',[appointment])).rows[0].data.status,'confirmed');
   const next=new Date(Date.parse(start)+2*3600000).toISOString();
   await as(customer,'select public.reschedule_my_appointment($1,$2,$3)',[appointment,next,member]);
   const current=(await db.query('select status,starts_at from public.appointments where id=$1',[appointment])).rows[0];
   const updated=(await as(owner,'select public.get_appointment_whatsapp($1) data',[appointment])).rows[0].data;
   assert.equal(Date.parse(updated.startsAt),Date.parse(next));assert.equal(updated.status,current.status);
   assert.deepEqual((await db.query('select status,starts_at from public.appointments where id=$1',[appointment])).rows[0],current);
 });
 const photo=()=>`${ws}/professionals/${member}/${randomUUID()}.webp`;
 const queue=(actor,p,id=member)=>as(null,'select public.queue_professional_photo($1,$2,$3)',[actor,id,p],'service_role');
 const swap=(actor,expected,next,id=member)=>as(null,'select public.swap_professional_photo($1,$2,$3,$4) ok',[actor,id,expected,next],'service_role');
 const first=photo(),second=photo();
 await t.test('photo upload gate rechecks actor; direct SQL, foreign tenant, receptionist and another professional are denied',async()=>{
   for(const actor of [other,reception,pro]) await assert.rejects(queue(actor,first),/not_authorized/);
   await assert.rejects(as(owner,'select public.queue_professional_photo($1,$2,$3)',[owner,member,first]),/permission denied/);
   await assert.rejects(as(owner,'update public.professional_profiles set photo_path=$1 where member_id=$2',[first,member]),/permission denied/);
   await assert.rejects(queue(owner,`${foreign}/professionals/${member}/${randomUUID()}.webp`),/invalid_image_path/);
   const ownPath=`${ws}/professionals/${proMember}/${randomUUID()}.webp`;
   await queue(pro,ownPath,proMember);
   await queue(owner,first);await assert.rejects(swap(owner,null,first),/invalid_image_path/);
   await db.query("insert into storage.objects(bucket_id,name) values('professional-photos',$1)",[first]);
   assert.equal((await swap(owner,null,first)).rows[0].ok,true);
 });
 await t.test('photo bytes private; public read only for the actual active linked bookable professional',async()=>{
   assert.equal((await as(null,'select public.get_professional_photo($1,$2) path',[member,slug])).rows[0].path,first);
   assert.equal((await as(null,'select public.get_professional_photo($1,$2) path',[member,'other-salon'])).rows[0].path,null);
   assert.equal((await as(null,'select count(*)::int n from storage.objects where bucket_id=\'professional-photos\'')).rows[0].n,0);
   await assert.rejects(as(owner,"insert into storage.objects(bucket_id,name) values('professional-photos',$1)",[photo()]),/row-level security/);
   await as(owner,'update public.professional_profiles set booking_enabled=false where member_id=$1',[member]);
   assert.equal((await as(null,'select public.get_professional_photo($1,$2) path',[member,slug])).rows[0].path,null);
   await as(owner,'update public.professional_profiles set booking_enabled=true where member_id=$1',[member]);
 });
 await t.test('inactive and removed professionals disappear publicly and lose self-edit permission',async()=>{
   const ownPath=`${ws}/professionals/${proMember}/${randomUUID()}.webp`;
   await queue(pro,ownPath,proMember);
   await db.query("insert into storage.objects(bucket_id,name) values('professional-photos',$1)",[ownPath]);
   assert.equal((await swap(pro,null,ownPath,proMember)).rows[0].ok,true);
   await as(owner,'insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)',[ws,proMember,service]);
   assert.equal((await as(null,'select public.get_professional_photo($1,$2) path',[proMember,slug])).rows[0].path,ownPath);
   for(const status of ['inactive','removed']){
     await as(owner,`select public.${status==='inactive'?'deactivate':'remove'}_workspace_member($1,$2)`,[ws,proMember]);
     assert.equal((await as(null,'select public.get_professional_photo($1,$2) path',[proMember,slug])).rows[0].path,null);
     await assert.rejects(queue(pro,`${ws}/professionals/${proMember}/${randomUUID()}.webp`,proMember),/not_authorized/);
   }
 });
 await t.test('photo replace/remove use CAS, exclude live references from cleanup, and preserve fallback',async()=>{
   await queue(owner,second);await db.query("insert into storage.objects(bucket_id,name) values('professional-photos',$1)",[second]);
   assert.equal((await swap(owner,null,second)).rows[0].ok,false);
   assert.equal((await swap(owner,first,second)).rows[0].ok,true);
   const claim=(await as(null,'select public.claim_professional_photo_cleanup($1) path',[member],'service_role')).rows.map(r=>r.path);
   assert.deepEqual(claim,[first]);await assert.rejects(swap(owner,second,first),/invalid_image_path/);
   assert.equal((await swap(owner,second,null)).rows[0].ok,true);
   assert.equal((await as(null,'select public.get_professional_photo($1,$2) path',[member,slug])).rows[0].path,null);
 });
 await t.test('one global private avatar is readable through legitimate appointments only, never writable by tenants',async()=>{
   const path=`avatars/${customer}/${randomUUID()}.webp`;
   assert.equal((await as(owner,'select public.get_related_client_avatar($1) path',[clientId])).rows[0].path,null);
   await db.query('update public.profiles set avatar_path=$1 where user_id=$2',[path,customer]);
   assert.equal((await as(owner,'select public.get_related_client_avatar($1) path',[clientId])).rows[0].path,path);
   assert.equal((await as(reception,'select public.get_related_client_avatar($1) path',[clientId])).rows[0].path,path);
   for(const actor of [other,pro,customer]) assert.equal((await as(actor,'select public.get_related_client_avatar($1) path',[clientId])).rows[0].path,null);
   await assert.rejects(as(null,'select public.get_related_client_avatar($1)',[clientId]),/permission denied/);
   await assert.rejects(as(owner,'select public.swap_account_avatar($1,null,null)',[customer]),/permission denied/);
   const manual=(await as(other,"insert into public.workspace_clients(workspace_id,full_name,email,phone) values($1,'Maria','customer@mission.invalid','+5532999999999') returning id",[foreign])).rows[0].id;
   assert.equal((await as(other,'select public.get_related_client_avatar($1) path',[manual])).rows[0].path,null);
   const otherService=(await as(other,"insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Corte B',60,9000) returning id",[foreign])).rows[0].id;
   await as(other,'insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)',[foreign,foreignMember,otherService]);
   await as(other,"insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6) n",[foreign,foreignMember]);
   const otherSlug=(await db.query('select slug from public.workspaces where id=$1',[foreign])).rows[0].slug;
   const otherAppointment=(await as(customer,book,[otherSlug,otherService,foreignMember,start])).rows[0].data.appointment_id;
   const related=(await db.query('select client_id from public.appointments where id=$1',[otherAppointment])).rows[0].client_id;
   assert.equal((await as(other,'select public.get_related_client_avatar($1) path',[related])).rows[0].path,path);
   assert.equal((await db.query('select count(*)::int n from public.profiles where user_id=$1 and avatar_path=$2',[customer,path])).rows[0].n,1);
   await as(customer,'select public.cancel_my_appointment($1)',[appointment]);
   await assert.rejects(as(owner,'select public.get_appointment_whatsapp($1)',[appointment]),/appointment_unavailable/);
 });
});
