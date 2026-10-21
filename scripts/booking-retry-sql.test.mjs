import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

test('public booking cannot retry into a second professional after an ambiguous response', async t => {
 const db=await createLocalDatabase(); t.after(()=>db.close());
 await db.exec(readFileSync('supabase/tests/helpers.sql','utf8'));
 const user=async(name,intent='professional',confirmed=true)=>(await db.query('select test_helpers.create_auth_user($1,$2,$3) id',[name+'@mission.invalid',intent,confirmed])).rows[0].id;
 const owner=await user('owner'),customer=await user('customer','client'),pro=await user('pro');
 const as=(uid,sql,args=[],role=uid?'authenticated':'anon')=>db.transaction(async tx=>{
   await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[uid??'',role]);
   await tx.exec('set local role '+role);return tx.query(sql,args);
 });
 const ws=(await as(owner,"select public.create_workspace('Mission Salon',null,'equipe') data")).rows[0].data.workspace_id;
 const member=(await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2',[ws,owner])).rows[0].id;
 const proMember=(await db.query("insert into public.workspace_members(workspace_id,user_id,role,status) values($1,$2,'professional','active') returning id",[ws,pro])).rows[0].id;
 const slug=(await db.query('select slug from public.workspaces where id=$1',[ws])).rows[0].slug;
 const service=(await as(owner,"insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Corte',60,8000) returning id",[ws])).rows[0].id;
 await as(owner,'insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)',[ws,member,service]);
 await as(owner,"insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6) n",[ws,member]);
 const start=(await db.query("select (((clock_timestamp() at time zone 'America/Sao_Paulo')::date+3)+time '10:00') at time zone 'America/Sao_Paulo' s")).rows[0].s;
 const book='select public.create_public_appointment($1,$2,$3,$4,\'Maria\',\'+5532999999999\',\'spoofed@mission.invalid\') data';
 await as(owner,'insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)',[ws,proMember,service]);
 await as(owner,"insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6) n",[ws,proMember]);
 const first=(await as(customer,book,[slug,service,null,start])).rows[0].data;
 await assert.rejects(as(customer,book,[slug,service,null,start]),/appointments_client_service_start_active_unique/);
 assert.equal((await db.query('select count(*)::int n from public.appointments where created_by=$1',[customer])).rows[0].n,1);
 assert.ok(first.appointment_id);
 await as(customer,'select public.cancel_my_appointment($1)',[first.appointment_id]);
 const count=async()=>Number((await db.query('select count(*) n from public.appointments')).rows[0].n);
 const unchanged=await count();
 await t.test('archived service cannot be booked from a stale catalog',async()=>{
  await as(owner,'update public.services set active=false where id=$1',[service]);
  await assert.rejects(as(customer,book,[slug,service,member,start]));assert.equal(await count(),unchanged);
  await as(owner,'update public.services set active=true where id=$1',[service]);
 });
 await t.test('disabled professional cannot be booked from a stale catalog',async()=>{
  await as(owner,'update public.professional_profiles set booking_enabled=false where member_id=$1',[member]);
  await assert.rejects(as(customer,book,[slug,service,member,start]));assert.equal(await count(),unchanged);
  await as(owner,'update public.professional_profiles set booking_enabled=true where member_id=$1',[member]);
 });
 await t.test('changed working hours reject the previously offered slot',async()=>{
  await as(owner,"update public.professional_working_hours set end_time='09:00' where professional_member_id=$1",[member]);
  await assert.rejects(as(customer,book,[slug,service,member,start]));assert.equal(await count(),unchanged);
 });
});
