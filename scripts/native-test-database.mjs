import { Client, Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';

const normalize=value=>process.platform==='win32'?resolve(value).replaceAll('\\','/').toLowerCase():resolve(value);
export function nativeTestConfig(env=process.env) {
  const port=Number(env.AGENDE_NATIVE_PG_PORT);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('A dedicated native test port is required');
  if(!env.AGENDE_NATIVE_PG_DATA)throw new Error('A dedicated native test data directory is required');
  const root=resolve('.test-postgres'),data=resolve(env.AGENDE_NATIVE_PG_DATA),rel=relative(root,data);
  if(!rel||rel.startsWith('..'+sep)||rel==='..'||isAbsolute(rel))throw new Error('Native data directory must be inside .test-postgres');
  return {host:'127.0.0.1',port,user:'postgres',password:'',ssl:false,connectionTimeoutMillis:10000,
    expectedData:data,application_name:'agende_isolated_test'};
}
async function verifyServer(client,config) {
  const row=(await client.query("select current_setting('server_version_num')::int version,current_setting('data_directory') data,current_setting('cluster_name') cluster")).rows[0];
  if(row.version<170000||row.version>=180000||row.cluster!=='agende_isolated_tests'||normalize(row.data)!==normalize(realpathSync(config.expectedData))) {
    throw new Error('Refusing an unverified PostgreSQL instance: requires owned local PG17 test cluster');
  }
}
export async function createNativeTestDatabase({throughVersion='99999999999999'}={}) {
  const config=nativeTestConfig(),admin=new Client({...config,database:'postgres'});
  await admin.connect();
  const database='agende_test_'+randomUUID().replaceAll('-','');
  try {
    await verifyServer(admin,config);
    await admin.query(`create database "${database}" template template0`);
  } finally {await admin.end();}
  const pool=new Pool({...config,database,max:4,idleTimeoutMillis:1000});
  const db={
    native:{host:config.host,port:config.port,database,major:17},
    query:(sql,args)=>pool.query(sql,args),
    async exec(sql){const result=await pool.query(sql);return Array.isArray(result)?result:[result];},
    async transaction(fn){const client=await pool.connect();try{await client.query('begin');const result=await fn({query:(sql,args)=>client.query(sql,args),exec:async sql=>{const result=await client.query(sql);return Array.isArray(result)?result:[result];}});await client.query('commit');return result;}catch(error){await client.query('rollback');throw error;}finally{client.release();}},
    async connection(name){const client=new Client({...config,database,application_name:name});await client.connect();return client;},
    close:()=>pool.end(),
  };
  try {
    await db.exec(readFileSync('scripts/test-platform.sql','utf8'));
    for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&f.slice(0,14)<=throughVersion).sort()){
      const sql=readFileSync('supabase/migrations/'+file,'utf8').replace(/create extension if not exists pg_cron with schema pg_catalog;/i,'-- Cron is a recorded local fixture, not a scheduler.');
      try{await db.exec(sql);}catch(error){throw new Error('Native migration failed: '+file+': '+error.message,{cause:error});}
    }
    return db;
  } catch(error){await db.close();throw error;}
}
