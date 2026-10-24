import test from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFileSync} from 'node:fs';
import {createLocalDatabase} from './local-database.mjs';
test('Supabase security advisors against verified owned PG17 only',async()=>{
 const db=await createLocalDatabase();
 try{
  if(!db.native)throw Error('Native owned database required');
  const url=`postgresql://postgres@127.0.0.1:${db.native.port}/${db.native.database}`;
  const command=`npx --yes supabase db advisors --db-url ${url} --type security --level error --fail-on error`;
  try{
   const program=process.platform==='win32'?'cmd.exe':'npx';
   const args=process.platform==='win32'?['/d','/s','/c',command]:['--yes','supabase','db','advisors','--db-url',url,'--type','security','--level','error','--fail-on','error'];
   const r=await promisify(execFile)(program,args,{windowsHide:true,timeout:45000,maxBuffer:200000,
     env:{...process.env,PGPORT:String(db.native.port),PGDATABASE:db.native.database}});
   writeFileSync('docs/homologation/pr84-advisors.txt',r.stdout+r.stderr);
  }catch(e){writeFileSync('docs/homologation/pr84-advisors.txt',String(e.stdout??'')+String(e.stderr??'')+e.message);throw e;}
 }finally{await db.close();}
});
