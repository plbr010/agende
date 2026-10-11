import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';

// Starts an owned, loopback-only portable cluster. Never reads DATABASE_URL.
const binary=name=>join(process.env.AGENDE_PG_BIN??'',name+(process.platform==='win32'?'.exe':''));
const childEnv={...process.env,PGHOST:'127.0.0.1',PGUSER:'postgres',PGPASSWORD:'',PGDATABASE:'postgres',PGSSLMODE:'disable',PGOPTIONS:'',PGSERVICE:'',PGSERVICEFILE:''};
async function command(program,args,env=childEnv,inherit=false){return new Promise((resolve,reject)=>{
  const child=spawn(program,args,{env,windowsHide:true,stdio:inherit?'inherit':['ignore','pipe','pipe']});let output='';
  child.stdout?.on('data',data=>{output+=data;});child.stderr?.on('data',data=>{output+=data;});
  child.once('error',reject);child.once('exit',code=>code===0?resolve(output):reject(new Error(`${program} failed (${code}): ${output.slice(-3000)}`)));
});}
async function freePort(){const socket=createServer();await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve);});const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));return port;}
const version=await command(binary('postgres'),['--version']);if(!/PostgreSQL\) 17\./.test(version))throw new Error('Native test runner requires PostgreSQL 17 binaries');
mkdirSync('.test-postgres',{recursive:true});const run=mkdtempSync(resolve('.test-postgres/run-')),data=join(run,'data'),port=await freePort();
const suites=process.argv.slice(2).length?process.argv.slice(2):['scripts/database.test.mjs','scripts/launch-readiness.test.mjs','scripts/final-hardening.test.mjs','scripts/atomic-service-sql.test.mjs','scripts/action-sql-integration.test.mjs','scripts/pg17-concurrency.test.mjs'];
let started=false,stopped=false,failure;
try{
  await command(binary('initdb'),['-D',data,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C']);
  await command(binary('pg_ctl'),['-D',data,'-l',join(run,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -c cluster_name=agende_isolated_tests`,'-w','start']);started=true;
  const client=new Client({host:'127.0.0.1',port,user:'postgres',password:'',database:'postgres',ssl:false});await client.connect();
  try{await client.query('create role anon;create role authenticated;create role service_role bypassrls');}finally{await client.end();}
  const env={...childEnv,AGENDE_NATIVE_PG_PORT:String(port),AGENDE_NATIVE_PG_DATA:data};
  console.log(JSON.stringify({native_version:version.trim(),host:'127.0.0.1',port,mode:'isolated native SQL; Auth/Storage/Cron are fixtures'}));
  await command(process.execPath,['--import','tsx','--test','--test-reporter=./scripts/test-category-reporter.mjs',...suites],env,true);
  await command(process.execPath,['scripts/audit-local-flows.mjs'],env,true);
}catch(error){failure=error;
}finally{
  if(started){try{await command(binary('pg_ctl'),['-D',data,'-m','fast','-w','stop']);stopped=true;console.log('Owned PG17 cluster stopped; synthetic data retained in ignored .test-postgres.');}catch(error){failure??=error;}}
  mkdirSync('docs/homologation',{recursive:true});writeFileSync('docs/homologation/native-pg17.json',JSON.stringify({checked_at:new Date().toISOString(),version:version.trim(),host:'127.0.0.1',port,suites,passed:!failure,server_stopped_after_run:stopped,auth:'synthetic SQL fixture; no Auth/SMTP service',data_policy:'owned test databases retained locally, ignored by Git'},null,2)+'\n');
}
if(failure)throw failure;
