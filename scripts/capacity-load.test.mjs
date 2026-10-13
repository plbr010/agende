// Opt-in, owned native cluster only. No HTTP, GoTrue, Stripe or remote credentials.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {cpus,totalmem} from 'node:os';
import {Pool} from 'pg';
import {createLocalDatabase} from './local-database.mjs';
import {nativeTestConfig} from './native-test-database.mjs';

const percentile=(values,p)=>values.toSorted((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*p)-1)];
test('isolated PostgreSQL burst matrix with bounded connections and real catalog/booking RPCs',async t=>{
  assert.equal(process.env.AGENDE_LOCAL_LOAD_ONLY,'1','Explicit local load opt-in required');
  assert.ok(process.env.AGENDE_NATIVE_PG_PORT,'Use run-pg17-tests.mjs to own the cluster');
  const db=await createLocalDatabase();assert.ok(db.native);t.after(()=>db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql','utf8'));
  const config=nativeTestConfig(),pool=new Pool({...config,database:db.native.database,max:16,idleTimeoutMillis:1000});
  t.after(()=>pool.end());
  const source=(await db.query("select version(),current_setting('max_connections') as max_connections")).rows[0];
  const bindings=[],date=new Date(Date.now()+3*86400000).toISOString().slice(0,10),weekday=new Date(date+'T12:00:00Z').getUTCDay();
  for(let i=0;i<100;i++){
    const uid=(await db.query("select test_helpers.create_auth_user($1,'professional',true) as id",[`load-owner-${i}@example.invalid`])).rows[0].id;
    const workspace=(await db.transaction(async tx=>{
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);
      await tx.exec('set local role authenticated');
      return(await tx.query("select public.create_workspace($1,null,'equipe') as data",['Load Synthetic '+i])).rows[0].data.workspace_id;
    }));
    const member=(await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2',[workspace,uid])).rows[0].id;
    const service=(await db.transaction(async tx=>{
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);await tx.exec('set local role authenticated');
      return(await tx.query("select public.save_service_with_professionals($1,null,'Corte Sintetico',null,30,5000,true,$2) as id",[workspace,[member]])).rows[0].id;
    }));
    await db.query("insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) values($1,$2,$3,'08:00','18:00')",[workspace,member,weekday]);
    await db.query("insert into public.workspace_clients(workspace_id,full_name) select $1,'Synthetic Client '||i from generate_series(1,100) i",[workspace]);
    const slug=(await db.query('select slug from public.workspaces where id=$1',[workspace])).rows[0].slug;
    const candidates=(await db.transaction(async tx=>{await tx.exec('set local role anon');return(await tx.query('select starts_at from public.list_public_available_slots($1,$2,$3,$4)',[slug,service,member,date])).rows.map(r=>r.starts_at)}));
    // API offers 15-minute candidates for a 30-minute service. Allocate disjoint slots.
    const slots=[];for(const candidate of candidates){if(!slots.length||new Date(candidate)-new Date(slots.at(-1))>=30*60000)slots.push(candidate);}
    assert.ok(slots.length>=14);bindings.push({uid,workspace,member,service,slug,slots});
  }
  let nextWrite=0;
  const scenarios=[];
  for(const users of [100,500,1000,5000]){
    const durations=[],execution=[],errors=[],counts={public_read:0,tenant_read:0,booking:0};let maxWaiting=0;
    const began=performance.now();
    await Promise.all(Array.from({length:users},async(_,actor)=>{
      const started=performance.now(),kind=actor%10<6?'public_read':actor%10<8?'tenant_read':'booking';
      const write=kind==='booking'?nextWrite++:null;
      const binding=bindings[(write??actor)%bindings.length];counts[kind]++;
      const pending=pool.connect();maxWaiting=Math.max(maxWaiting,pool.waitingCount);
      let client;
      try{
        client=await pending;const active=performance.now();
        await client.query('begin');await client.query("set local statement_timeout='10s'; set local lock_timeout='2s'");
        if(kind==='tenant_read'){
          await client.query("select set_config('request.jwt.claim.sub',$1,true)",[binding.uid]);await client.query('set local role authenticated');
          const services=await client.query('select id,name,duration_minutes,price_cents from public.services where workspace_id=$1 and archived_at is null order by name limit 25',[binding.workspace]);assert.ok(services.rowCount);
          const foreign=await client.query('select id from public.services where workspace_id=$1',[bindings[(actor+1)%100].workspace]);assert.equal(foreign.rowCount,0);
          await client.query('select id,full_name from public.workspace_clients where workspace_id=$1 order by id limit 25',[binding.workspace]);
        }else{
          await client.query('set local role anon');
          if(kind==='public_read')await client.query('select public.list_public_booking_catalog($1)',[binding.slug]);
          else{
            const slot=binding.slots[Math.floor(write/100)];assert.ok(slot);
            await client.query('select public.create_public_appointment($1,$2,$3,$4,$5,$6,$7,null,$8)',[binding.slug,binding.service,binding.member,slot,'Synthetic Load Client','+55119'+String(write).padStart(8,'0'),`load-${write}@example.invalid`,'load-'+write]);
          }
        }
        await client.query('commit');execution.push(performance.now()-active);
      }catch(error){
        errors.push({kind,code:error.code??'harness_assertion'});if(client)await client.query('rollback');
      }finally{client?.release();durations.push(performance.now()-started);}
    }));
    const elapsed=performance.now()-began,errorRate=errors.length/users;
    scenarios.push({virtual_actors:users,simultaneous_submission:true,db_pool_limit:16,identities_shared_across_actors:100,counts,unexpected_errors:errors.length,error_codes:errors.reduce((m,e)=>({...m,[e.code]:(m[e.code]??0)+1}),{}),error_rate:errorRate,elapsed_ms:elapsed,throughput_actions_per_second:users/(elapsed/1000),end_to_end_including_queue_ms:{p50:percentile(durations,.5),p95:percentile(durations,.95),p99:percentile(durations,.99)},db_transaction_ms:{p50:percentile(execution,.5),p95:percentile(execution,.95),p99:percentile(execution,.99)},peak_pool_waiters:maxWaiting,slo:{p95_ms:2000,max_error_rate:.01,passed:percentile(durations,.95)<=2000&&errorRate<=.01}});
  }
  mkdirSync('docs/commercial-readiness',{recursive:true});
  const report={checked_at:new Date().toISOString(),mode:'native PG17 synthetic SQL burst; not HTTP/cloud capacity validation',production_or_staging_requests:0,auth:'SQL identity fixtures; no GoTrue',stripe:'not called',fixture:{workspaces:100,clients:10000,services:100,professionals:100},hardware:{cpu:cpus()[0]?.model,logical_cpus:cpus().length,total_ram_bytes:totalmem(),os:process.platform},server:source,scenarios,production_capacity_certified:false};
  writeFileSync('docs/commercial-readiness/load-results.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({local_load_completed:true,scenarios:scenarios.map(s=>({users:s.virtual_actors,p95_ms:s.end_to_end_including_queue_ms.p95,errors:s.unexpected_errors,slo_passed:s.slo.passed})),production_capacity_certified:false}));
  assert.equal(scenarios.reduce((n,s)=>n+s.unexpected_errors,0),0,'Workload errors; capacity SLOs are reported separately');
});
