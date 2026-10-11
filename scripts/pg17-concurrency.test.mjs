import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createLocalDatabase } from './local-database.mjs';

if(!process.env.AGENDE_NATIVE_PG_PORT)throw new Error('Use run-pg17-tests.mjs; concurrency requires native PostgreSQL 17, not PGlite');
const evidence=[];
after(()=>{mkdirSync('docs/homologation',{recursive:true});writeFileSync('docs/homologation/pg17-concurrency.json',JSON.stringify({checked_at:new Date().toISOString(),engine:'native PostgreSQL 17',authentication:'SQL identity fixture, not Auth service',cases:evidence},null,2)+'\n');});
async function begin(client,uid,role=uid?'authenticated':'anon'){
  await client.query('begin');
  if(uid)await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[uid]);
  assert.ok(['anon','authenticated','service_role'].includes(role));await client.query('set local role '+role);
}
async function as(db,uid,sql,args=[],role=uid?'authenticated':'anon'){
  return db.transaction(async tx=>{
    if(uid)await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[uid]);
    await tx.exec('set local role '+role);return tx.query(sql,args);
  });
}
async function fixture(t,label){
  const db=await createLocalDatabase();assert.ok(db.native);t.after(()=>db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql','utf8'));
  const email=suffix=>label+'-'+suffix+'@pg17-local.invalid';
  const user=async(suffix,intent='professional')=>(await db.query('select test_helpers.create_auth_user($1,$2,true) id',[email(suffix),intent])).rows[0].id;
  const owner=await user('owner'),clientA=await user('a','client'),clientB=await user('b','client');
  const workspace=(await as(db,owner,"select public.create_workspace($1,null,'equipe') data",['Concurrent '+label])).rows[0].data.workspace_id;
  const row=(await db.query('select m.id member,w.slug from public.workspace_members m join public.workspaces w on w.id=m.workspace_id where m.workspace_id=$1 and m.user_id=$2',[workspace,owner])).rows[0];
  const service=(await as(db,owner,"insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Corte',60,8000) returning id",[workspace])).rows[0].id;
  await as(db,owner,'insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3)',[workspace,row.member,service]);
  await as(db,owner,"insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6) n",[workspace,row.member]);
  const date=(await db.query("select ((clock_timestamp() at time zone 'America/Sao_Paulo')::date+3)::text d")).rows[0].d;
  return{db,owner,clientA,clientB,workspace,member:row.member,slug:row.slug,service,date,email,user};
}
const bookSql='select public.create_public_appointment($1,$2,$3,($4::date+$5::time) at time zone \'America/Sao_Paulo\',$6,$7,$8,null,null) data';
const bookArgs=(f,hour,customer='a',member=f.member)=>[f.slug,f.service,member,f.date,hour,'Cliente local '+customer,customer==='a'?'55999999999':'11988887777',f.email(customer)];

async function waitForBlock(db,waiting,blocking){
  const end=Date.now()+5000;
  while(Date.now()<end){
    const row=(await db.query('select wait_event_type,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=$1',[waiting])).rows[0];
    if(row?.wait_event_type==='Lock'&&row.blockers.includes(blocking))return row;
    await delay(25);
  }
  throw new Error('Expected a genuine overlapping lock wait between independent PG backends');
}
async function race(f,name,sql,argsA,argsB,{uidA=null,uidB=null,role,release='commit'}={}){
  const a=await f.db.connection('agende_race_a'),b=await f.db.connection('agende_race_b');let pending;
  try{
    const pidA=(await a.query('select pg_backend_pid() pid')).rows[0].pid,pidB=(await b.query('select pg_backend_pid() pid')).rows[0].pid;assert.notEqual(pidA,pidB);
    await begin(a,uidA,role);await begin(b,uidB,role);
    const first=await a.query(sql,argsA);
    pending=b.query(sql,argsB).then(result=>({ok:true,result}),error=>({ok:false,code:error.code,message:error.message}));
    const wait=await waitForBlock(f.db,pidB,pidA);await a.query(release);
    const second=await pending;if(second.ok)await b.query('commit');else await b.query('rollback');
    evidence.push({name,pid_a:pidA,pid_b:pidB,verified_wait:wait.wait_event_type,release_a:release,b_success:second.ok,b_sqlstate:second.code??null});
    return{first,second};
  }finally{
    await a.query('rollback').catch(()=>{});if(pending)await pending;await b.query('rollback').catch(()=>{});
    await Promise.allSettled([a.end(),b.end()]);
  }
}

test('PG17 concurrent public reservations: one winner for the same professional/slot',{timeout:30000},async t=>{
  const f=await fixture(t,'same-slot');
  const result=await race(f,'same slot',bookSql,bookArgs(f,'10:00','a'),bookArgs(f,'10:00','b'));
  assert.equal(result.second.ok,false);assert.match(result.second.message,/overlap|slot_taken/);
  assert.equal((await f.db.query('select count(*)::int n from public.appointments where workspace_id=$1',[f.workspace])).rows[0].n,1);
});

test('PG17 a rolled-back reservation frees the waiting client to book',{timeout:30000},async t=>{
  const f=await fixture(t,'rollback-slot');
  const result=await race(f,'booking rollback',bookSql,bookArgs(f,'10:00','a'),bookArgs(f,'10:00','b'),{release:'rollback'});
  assert.equal(result.second.ok,true);
  assert.equal((await f.db.query('select count(*)::int n from public.appointments where workspace_id=$1',[f.workspace])).rows[0].n,1);
});

test('PG17 concurrent client reschedules cannot converge on one occupied slot',{timeout:30000},async t=>{
  const f=await fixture(t,'reschedule');
  const a=(await as(f.db,null,bookSql,bookArgs(f,'10:00','a'))).rows[0].data.appointment_id;
  const b=(await as(f.db,null,bookSql,bookArgs(f,'14:00','b'))).rows[0].data.appointment_id;
  const target=(await f.db.query("select ($1::date+time '12:00') at time zone 'America/Sao_Paulo' t",[f.date])).rows[0].t;
  const result=await race(f,'reschedule collision','select public.reschedule_my_appointment($1,$2,$3) data',[a,target,f.member],[b,target,f.member],{uidA:f.clientA,uidB:f.clientB});
  assert.equal(result.second.ok,false);assert.match(result.second.message,/overlap|slot_taken/);
  assert.equal((await f.db.query('select count(*)::int n from public.appointments where workspace_id=$1 and starts_at=$2',[f.workspace,target])).rows[0].n,1);
  assert.equal((await f.db.query('select count(*)::int n from public.appointments where workspace_id=$1',[f.workspace])).rows[0].n,2);
});

test('PG17 duplicate concurrent reviews persist exactly one immutable rating',{timeout:30000},async t=>{
  const f=await fixture(t,'reviews');const id=(await as(f.db,null,bookSql,bookArgs(f,'10:00','a'))).rows[0].data.appointment_id;
  for(const status of ['confirmed','in_progress','completed'])await as(f.db,f.owner,'select public.set_appointment_status($1,$2::public.appointment_status)',[id,status]);
  const result=await race(f,'review uniqueness','select public.submit_appointment_review($1,$2,null) data',[id,5],[id,4],{uidA:f.clientA,uidB:f.clientA});
  assert.equal(result.second.ok,false);assert.match(result.second.message,/already_reviewed/);
  const rows=(await f.db.query('select rating from public.appointment_reviews where appointment_id=$1',[id])).rows;assert.equal(rows.length,1);assert.equal(rows[0].rating,5);
});

test('PG17 concurrent owner demotions retain one active owner',{timeout:30000},async t=>{
  const f=await fixture(t,'owners');const second=await f.user('second-owner');
  const secondMember=(await f.db.query("insert into public.workspace_members(workspace_id,user_id,role,status) values($1,$2,'owner','active') returning id",[f.workspace,second])).rows[0].id;
  const result=await race(f,'last owner','select public.update_workspace_member_role($1,$2,\'admin\') data',[f.workspace,f.member],[f.workspace,secondMember],{uidA:f.owner,uidB:second});
  assert.equal(result.second.ok,false);assert.match(result.second.message,/last_owner_protected/);
  assert.equal((await f.db.query("select count(*)::int n from public.workspace_members where workspace_id=$1 and role='owner' and status='active'",[f.workspace])).rows[0].n,1);
});

test('PG17 concurrent invite acceptance cannot exceed the plan seat limit',{timeout:30000},async t=>{
  const f=await fixture(t,'seats');
  for(let n=0;n<3;n++){const uid=await f.user('existing-'+n);await f.db.query("insert into public.workspace_members(workspace_id,user_id,role,status) values($1,$2,'professional','active')",[f.workspace,uid]);}
  const a=await f.user('candidate-a'),b=await f.user('candidate-b');
  const invite=async suffix=>(await as(f.db,f.owner,"select public.create_workspace_invite($1,'professional',$2) data",[f.workspace,f.email(suffix)])).rows[0].data.token;
  const result=await race(f,'seat limit','select public.accept_workspace_invite($1) data',[await invite('candidate-a')],[await invite('candidate-b')],{uidA:a,uidB:b});
  assert.equal(result.second.ok,false);assert.match(result.second.message,/professional_limit|seat_limit/);
  assert.equal((await f.db.query('select app.workspace_professional_seats($1) n',[f.workspace])).rows[0].n,5);
});

test('PG17 concurrent billing-event replay returns one event ID',{timeout:30000},async t=>{
  const f=await fixture(t,'events');
  const result=await race(f,'billing replay',"select public.record_billing_event($1,'stripe','evt_local_concurrent','invoice.paid',8000,'BRL','monthly','paid') data",[f.workspace],[f.workspace],{role:'service_role'});
  assert.equal(result.second.ok,true);assert.equal(result.first.rows[0].data,result.second.result.rows[0].data);
  assert.equal((await f.db.query("select count(*)::int n from public.billing_events where external_event_id='evt_local_concurrent'")).rows[0].n,1);
});

test('PG17 concurrent checkout leases cannot both acquire the same workspace',{timeout:30000},async t=>{
  const f=await fixture(t,'leases');
  const result=await race(f,'checkout lease','select public.acquire_stripe_checkout($1,$2) data',[f.workspace,randomUUID()],[f.workspace,randomUUID()],{role:'service_role'});
  assert.equal(result.first.rows[0].data,true);assert.equal(result.second.ok,true);assert.equal(result.second.result.rows[0].data,false);
});
