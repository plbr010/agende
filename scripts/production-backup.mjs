// Explicit production export opt-in. No application writes or migrations.
// Archives encrypted in flight; only owned, loopback-only restore targets.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer,connect as tcpConnect} from 'node:net';
import {connect as tlsConnect} from 'node:tls';
import {createCipheriv,createDecipheriv,createHash,createHmac,timingSafeEqual,randomBytes,scryptSync} from 'node:crypto';
import {createWriteStream,readFileSync,writeFileSync,existsSync,rmSync,realpathSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Client} from 'pg';

const project='wohimauqgywshbbejjcl';
const bin='C:/Users/PLBR/Documents/Codex/.agende-test-runtime/pg17/pgsql/bin';
const powershell='C:/Users/PLBR/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';
const base=resolve(process.env.LOCALAPPDATA??'', 'AgendePrivateRecovery');
const core=['app','public','auth','extensions','supabase_migrations'];
const compatible=['plpgsql','pgcrypto','uuid-ossp','btree_gist','unaccent','pg_stat_statements'];
const args=process.argv.slice(2),mode=args[0];
const option=name=>args[args.indexOf(name)+1];
const exe=name=>join(bin,name+'.exe');
const quote=value=>'"'+value.replaceAll('"','""')+'"';
const sha=value=>createHash('sha256').update(value).digest('hex');
const jsonFile=(path,data)=>writeFileSync(path,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
const cleanEnv=()=>Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG')&&key.toUpperCase()!=='DATABASE_URL'));
const localEnv=(port,user,password)=>({...cleanEnv(),PGHOST:'127.0.0.1',PGPORT:String(port),PGUSER:user,PGDATABASE:'postgres',PGPASSWORD:password,PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'10'});

async function run(program,argv,env=cleanEnv(),input){
  const child=spawn(program,argv,{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
  let output='',diagnostic='';child.stdout.on('data',chunk=>{output+=chunk});
  // Never expose stderr: provider errors/COPY diagnostics may include PII.
  child.stderr.on('data',chunk=>{if(mode==='prepare'||mode==='selftest')diagnostic+=chunk});
  const done=new Promise((ok,fail)=>{child.once('error',()=>fail(new Error('process_start_failed')));child.once('exit',code=>code===0?ok(output):fail(new Error((mode==='prepare'||mode==='selftest'?program+': '+diagnostic+' ':'')+'process_failed_'+code)))});
  if(input)child.stdin.end(input);else child.stdin.end();
  return done;
}
async function privateDir(path){
  assert.equal(process.platform,'win32');assert.ok(process.env.LOCALAPPDATA);
  await run(powershell,['-NoProfile','-NonInteractive','-File',resolve('scripts/backup-private-dir.ps1'),'-Path',path]);
  return path;
}
function contained(path){
  const full=realpathSync(path),rel=relative(realpathSync(base),full);
  assert.ok(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'private_path_required');return full;
}
async function versions(){
  for(const name of ['pg_dump','pg_dumpall','pg_restore','postgres','psql']){
    assert.match(await run(exe(name),['--version']),/17\.6/,'tool_version_mismatch');
  }
}
async function freePort(){const socket=createServer();await new Promise((ok,fail)=>{socket.once('error',fail);socket.listen(0,'127.0.0.1',ok)});const port=socket.address().port;await new Promise(ok=>socket.close(ok));return port;}
async function cluster(parent,label){
  const root=join(parent,label);assert.ok(!existsSync(root));await privateDir(root);
  const data=join(root,'data'),password=randomBytes(32).toString('hex'),user='agende_'+label+'_admin',port=await freePort();
  const pwfile=join(root,'init-password');writeFileSync(pwfile,password+'\n',{flag:'wx'});
  const env=localEnv(port,user,password);
  try{await run(exe('initdb'),['-D',data,'-U',user,'--auth=scram-sha-256','--encoding=UTF8','--locale=C','--pwfile='+pwfile],env)}finally{rmSync(pwfile,{force:true})}
  const labelName='agende_owned_'+label;
  await run(exe('pg_ctl'),['-D',data,'-l',join(root,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -c cluster_name=${labelName} -c log_statement=none -c log_min_error_statement=panic -c log_error_verbosity=terse`,'-w','start'],env);
  writeFileSync(join(root,'.owned-recovery'),labelName,{flag:'wx'});
  const client=new Client({host:'127.0.0.1',port,user,password,database:'postgres',ssl:false});await client.connect();
  const observed=(await client.query("select current_setting('cluster_name') as label,current_setting('data_directory') as path")).rows[0];
  assert.equal(observed.label,labelName);assert.equal(resolve(observed.path),resolve(data));
  return{root,data,port,user,password,env,client,async stop(){await client.end();await run(exe('pg_ctl'),['-D',data,'-m','fast','-w','stop'],env);contained(root);assert.equal(readFileSync(join(root,'.owned-recovery'),'utf8'),labelName);rmSync(root,{recursive:true});}};
}
function cipherKey(phrase,salt){assert.ok(typeof phrase==='string'&&phrase.length>=20,'backup_passphrase_too_short');return scryptSync(phrase,Buffer.from(salt,'hex'),32,{N:32768,r:8,p:1,maxmem:64*1024*1024})}
const manifestMac=(data,key)=>createHmac('sha256',key).update(JSON.stringify(data)).digest('hex');
function authenticateManifest(manifest,key){const {authentication,...unsigned}=manifest;assert.ok(authentication&&/^[0-9a-f]{64}$/.test(authentication),'manifest_authentication_missing');assert.ok(timingSafeEqual(Buffer.from(authentication,'hex'),Buffer.from(manifestMac(unsigned,key),'hex')),'manifest_authentication_failed')}
async function encryptProcess(path,name,argv,env,key){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(path.split(/[\\/]/).at(-1)));
  const child=spawn(exe(name),argv,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',()=>{});
  const done=new Promise((ok,fail)=>{child.once('error',()=>fail(new Error('dump_start_failed')));child.once('exit',code=>code===0?ok():fail(new Error('dump_failed_'+code)))});
  const writing=pipeline(child.stdout,cipher,createWriteStream(path,{flags:'wx'}));
  const result=await Promise.allSettled([done,writing]);
  if(result.some(x=>x.status==='rejected'))throw new Error('encrypted_dump_failed');
  return{file:path.split(/[\\/]/).at(-1),iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),sha256:sha(readFileSync(path)),bytes:readFileSync(path).length};
}
function encryptJson(path,data,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(path.split(/[\\/]/).at(-1)));const blob=Buffer.concat([cipher.update(JSON.stringify(data)),cipher.final()]);writeFileSync(path,blob,{flag:'wx'});return{file:path.split(/[\\/]/).at(-1),iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),sha256:sha(blob),bytes:blob.length}}
function decrypt(path,entry,key){contained(path);assert.ok(/^[a-z]+\.(dump|sql|json)\.enc$/.test(entry.file),'invalid_archive_path');const blob=readFileSync(join(path,entry.file));assert.equal(sha(blob),entry.sha256,'ciphertext_checksum_mismatch');const d=createDecipheriv('aes-256-gcm',key,Buffer.from(entry.iv,'hex'));d.setAAD(Buffer.from(entry.file));d.setAuthTag(Buffer.from(entry.tag,'hex'));return Buffer.concat([d.update(blob),d.final()])}
async function restoreProcess(path,entry,key,name,argv,env){
  assert.equal(env.PGHOST,'127.0.0.1');
  let diagnostic='';
  const child=spawn(exe(name),argv,{env,windowsHide:true,stdio:['pipe','pipe','pipe']});child.stdout.on('data',()=>{});child.stderr.on('data',chunk=>{if(mode==='selftest')diagnostic+=chunk});
  const done=new Promise((ok,fail)=>{child.once('error',()=>fail(new Error('restore_start_failed')));child.once('exit',code=>code===0?ok():fail(new Error('restore_failed_'+code)))});
  const writing=new Promise((ok,fail)=>{child.stdin.once('error',()=>fail(new Error('restore_input_failed')));child.stdin.end(decrypt(path,entry,key),ok)});
  const result=await Promise.allSettled([done,writing]);if(result.some(x=>x.status==='rejected'))throw new Error('restore_failed'+(mode==='selftest'?': '+diagnostic:''));
}
async function inventory(client){
  const tables=(await client.query('select schemaname,tablename from pg_tables where schemaname=ANY($1) order by schemaname,tablename',[core])).rows;
  const data=[];
  for(const t of tables){
    const id=quote(t.schemaname)+'.'+quote(t.tablename);
    const r=(await client.query(`with hashes as (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') as h from ${id} t) select count(*)::text as rows,encode(sha256(convert_to(coalesce(string_agg(h,'' order by h),''),'UTF8')),'hex') as fingerprint from hashes`)).rows[0];data.push({...t,...r});
  }
  // Canonical metadata, never any passwords or table row values.
  const catalog=(await client.query(`select jsonb_build_object(
    'columns',(select jsonb_agg(to_jsonb(x) order by x.table_schema,x.table_name,x.ordinal_position) from (select table_schema,table_name,column_name,ordinal_position,data_type,udt_schema,udt_name,is_nullable,column_default from information_schema.columns where table_schema=ANY($1)) x),
    'policies',(select jsonb_agg(to_jsonb(x) order by x.schemaname,x.tablename,x.policyname) from pg_policies x where schemaname=ANY($1)),
    'rls',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity,'force',c.relforcerowsecurity) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname=ANY($1)),
    'constraints',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid)) order by n.nspname,c.relname,k.conname) from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=ANY($1)),
    'triggers',(select jsonb_agg(pg_get_triggerdef(t.oid) order by n.nspname,c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname=ANY($1)),
    'table_acl',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','v','S') and n.nspname=ANY($1)),
    'views',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'definition',pg_get_viewdef(c.oid)) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='v' and n.nspname=ANY($1)),
    'functions',(select jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind in ('f','p') and n.nspname=ANY($1) and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'))
  ) as catalog`,[core])).rows[0].catalog;
  const roles=(await client.query("select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls from pg_roles where rolname not like 'pg_%' order by rolname")).rows;
  const grants=(await client.query("select parent.rolname as parent,member.rolname as member,m.admin_option,m.inherit_option,m.set_option from pg_auth_members m join pg_roles parent on parent.oid=m.roleid join pg_roles member on member.oid=m.member where member.rolname not like 'pg_%' order by parent.rolname,member.rolname")).rows;
  const extensions=(await client.query('select e.extname,e.extversion,n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace order by e.extname')).rows;
  return{data,catalog,roles,grants,extensions};
}
async function exportBackup(source,path,phrase,synthetic=false){
  const started=new Date().toISOString(),salt=randomBytes(16).toString('hex'),key=cipherKey(phrase,salt),files=[];
  await source.client.query("begin isolation level repeatable read read only; set local timezone='UTC'; set local search_path=pg_catalog; set local row_security=off");
  const snapshot=(await source.client.query('select pg_export_snapshot() as id')).rows[0].id;
  const snapshotAt=new Date().toISOString();
  try{
    const observed=await inventory(source.client);
    files.push(await encryptProcess(join(path,'database.dump.enc'),'pg_dump',['--format=custom','--lock-wait-timeout=5s','--snapshot='+snapshot,'--no-password'],source.env,key));
    // -n alone omits CREATE EXTENSION entries: include each compatible module explicitly.
    const coreArgs=[...core.map(s=>'--schema='+s),...observed.extensions.filter(e=>compatible.includes(e.extname)).map(e=>'--extension='+e.extname)];
    files.push(await encryptProcess(join(path,'core.dump.enc'),'pg_dump',['--format=custom','--lock-wait-timeout=5s','--snapshot='+snapshot,'--no-password',...coreArgs],source.env,key));
    files.push(await encryptProcess(join(path,'roles.sql.enc'),'pg_dumpall',['--roles-only','--no-role-passwords','--no-password'],source.env,key));
    files.push(encryptJson(join(path,'snapshot.json.enc'),observed,key));
    await source.client.query('commit');
    const manifest={format:3,mode:synthetic?'synthetic_selftest':'production_export',project:synthetic?null:project,started_at:started,snapshot_at:snapshotAt,completed_at:new Date().toISOString(),encryption:'AES-256-GCM',kdf:{name:'scrypt',salt,N:32768,r:8,p:1},files,restore_scope:core,full_platform_restore_verified:false,role_passwords:'excluded; independent credentials required',restore_verified:false};
    manifest.authentication=manifestMac(manifest,key);
    jsonFile(join(path,'manifest.json'),manifest);return manifest;
  }catch{await source.client.query('rollback');throw new Error('backup_export_failed')}
  finally{key.fill(0)}
}
async function restoreBackup(path,phrase){
  contained(path);const manifest=JSON.parse(readFileSync(join(path,'manifest.json'),'utf8'));
  assert.equal(manifest.format,3);assert.ok(manifest.mode==='synthetic_selftest'||manifest.project===project);
  const key=cipherKey(phrase,manifest.kdf.salt);authenticateManifest(manifest,key);
  const source=JSON.parse(decrypt(path,manifest.files.find(x=>x.file==='snapshot.json.enc'),key));
  assert.deepEqual(manifest.files.map(x=>x.file).sort(),['core.dump.enc','database.dump.enc','roles.sql.enc','snapshot.json.enc']);
  for(const entry of manifest.files)assert.equal(sha(readFileSync(join(path,entry.file))),entry.sha256,'archive_checksum_mismatch');
  for(const entry of manifest.files){const clear=decrypt(path,entry,key);clear.fill(0);}
  // Only compatible extension definitions; no Cron/Vault jobs or remote services.
  const started=Date.now(),target=await cluster(path,'restore');let passed=false,evidence;
  try{
    await restoreProcess(path,manifest.files.find(x=>x.file==='database.dump.enc'),key,'pg_restore',['--list'],target.env);
    await restoreProcess(path,manifest.files.find(x=>x.file==='roles.sql.enc'),key,'psql',['-X','--set=ON_ERROR_STOP=1','--single-transaction'],target.env);
    // Fresh owned target only; no CASCADE, no business records, never a source.
    await target.client.query('drop schema public');
    for(const e of source.extensions.filter(e=>compatible.includes(e.extname))){
      const available=(await target.client.query('select 1 from pg_available_extension_versions where name=$1 and version=$2',[e.extname,e.extversion])).rowCount;
      assert.equal(available,1,'extension_version_not_available');
    }
    await restoreProcess(path,manifest.files.find(x=>x.file==='core.dump.enc'),key,'pg_restore',['--exit-on-error','--single-transaction','--dbname=postgres'],target.env);
    for(const e of source.extensions.filter(e=>compatible.includes(e.extname))){
      const actual=(await target.client.query('select extversion from pg_extension where extname=$1',[e.extname])).rows[0];
      assert.equal(actual?.extversion,e.extversion,'restored_extension_version_mismatch');
    }
    await target.client.query("set timezone='UTC'; set search_path=pg_catalog; set row_security=off");
    const restored=await inventory(target.client);
    assert.deepEqual(restored.data,source.data,'restored_table_content_mismatch');
    assert.deepEqual(restored.catalog,source.catalog,'restored_catalog_mismatch');
    assert.deepEqual(restored.roles.filter(r=>r.rolname!==target.user),source.roles,'restored_role_attributes_mismatch');
    assert.deepEqual(restored.grants,source.grants,'restored_role_grants_mismatch');
    const serials=(await target.client.query("select table_schema,table_name,column_name,pg_get_serial_sequence(format('%I.%I',table_schema,table_name),column_name) as sequence from information_schema.columns where table_schema=any($1) and pg_get_serial_sequence(format('%I.%I',table_schema,table_name),column_name) is not null",[core])).rows;
    for(const s of serials){
      const state=(await target.client.query(`select last_value::text,is_called from ${s.sequence}`)).rows[0];
      const inc=BigInt((await target.client.query('select seqincrement::text from pg_sequence where seqrelid=$1::regclass',[s.sequence])).rows[0].seqincrement);
      const extrema=(await target.client.query(`select max(${quote(s.column_name)})::text as highest,min(${quote(s.column_name)})::text as lowest from ${quote(s.table_schema)}.${quote(s.table_name)}`)).rows[0];
      if(extrema.highest!==null){const next=BigInt(state.last_value)+(state.is_called?inc:0n);assert.ok(inc>0n?next>BigInt(extrema.highest):next<BigInt(extrema.lowest),'restored_sequence_collision');}
    }
    passed=true;
    evidence={checked_at:new Date().toISOString(),passed:true,scope:core,all_encrypted_files_authenticated:true,full_archive_toc_readable:true,table_content_fingerprints_equal:true,catalog_equal:true,role_attributes_and_memberships_equal:true,sequences_checked:serials.length,auth_database_rows_verified:source.data.some(x=>x.schemaname==='auth'&&x.tablename==='users'),full_platform_restore_verified:false,restored_tables:source.data.length,production_writes:0,staging_connections:0};
  }finally{key.fill(0);await target.stop();if(!passed)jsonFile(join(path,'restore-failed.json'),{checked_at:new Date().toISOString(),passed:false,raw_errors_withheld:true});}
  evidence.rto_seconds=(Date.now()-started)/1000;evidence.owned_cluster_stopped=true;evidence.temporary_plaintext_cluster_removed=true;
  jsonFile(join(path,'restore-evidence.json'),evidence);return evidence;
}
async function secrets(){let raw='';for await(const chunk of process.stdin)raw+=chunk;return JSON.parse(raw)}
function validateSource(config){
  assert.equal(config.project,project);assert.equal(config.database,'postgres');assert.equal(config.port,5432);
  const direct=config.host==='db.'+project+'.supabase.co'&&config.user==='postgres';
  const pooler=/^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(config.host)&&config.user==='postgres.'+project;
  assert.ok(direct||pooler,'production_endpoint_not_allowed');assert.ok(config.caFile&&existsSync(config.caFile),'trusted_ca_required');contained(config.caFile);
}
async function tlsProbe(config){
  validateSource(config);
  return new Promise((ok,fail)=>{
    const socket=tcpConnect({host:config.host,port:config.port});let tls;
    const stop=()=>{tls?.destroy();socket.destroy();fail(new Error('tls_probe_failed'))};
    socket.setTimeout(10000,stop);socket.once('error',stop);
    socket.once('connect',()=>socket.write(Buffer.from([0,0,0,8,4,210,22,47])));
    socket.once('data',data=>{
      if(data.toString()!=='S')return stop();
      socket.setTimeout(0);
      tls=tlsConnect({socket,servername:config.host,ca:readFileSync(config.caFile,'utf8'),rejectUnauthorized:true});
      tls.setTimeout(10000,stop);tls.once('error',stop);
      tls.once('secureConnect',()=>{const cert=tls.getPeerCertificate();const result={tls_verified:tls.authorized,host:config.host,port:config.port,protocol:tls.getProtocol(),peer_certificate_sha256:cert.fingerprint256,authentication_attempted:false,production_data_read:false,production_writes:0};tls.destroy();ok(result)});
    });
  });
}
async function productionSource(config,password){
  validateSource(config);assert.ok(password);
  const ca=readFileSync(config.caFile,'utf8');
  const client=new Client({host:config.host,port:config.port,user:config.user,password,database:'postgres',ssl:{ca,rejectUnauthorized:true},connectionTimeoutMillis:10000,options:'-c default_transaction_read_only=on -c statement_timeout=600000 -c lock_timeout=5000'});
  await client.connect();
  const tls=(await client.query('select ssl,version from pg_stat_ssl where pid=pg_backend_pid()')).rows[0];assert.equal(tls.ssl,true,'tls_required');
  return{client,env:{...cleanEnv(),PGHOST:config.host,PGPORT:String(config.port),PGUSER:config.user,PGDATABASE:'postgres',PGPASSWORD:password,PGSSLMODE:'verify-full',PGSSLROOTCERT:config.caFile,PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=600000 -c lock_timeout=5000'}};
}

try{
  await versions();await privateDir(base);
  if(mode==='prepare'){
    const example=join(base,'source.example.json');
    if(!existsSync(example))jsonFile(example,{project,host:'db.'+project+'.supabase.co',port:5432,user:'postgres',database:'postgres',caFile:join(base,'supabase-root.crt')});
    console.log(JSON.stringify({prepared:true,postgres:'17.6',private_root:base,production_access:false,config_template:example,missing_native_extensions:['pg_cron','supabase_vault']}));
  }else if(mode==='check-tls'){
    const config=JSON.parse(readFileSync(contained(option('--config')),'utf8'));
    console.log(JSON.stringify(await tlsProbe(config)));
  }else if(mode==='selftest'){
    const path=await privateDir(join(base,'synthetic-'+Date.now()));const source=await cluster(path,'fixture');
    const phrase='synthetic-only-backup-passphrase-2026';
    try{
      await source.client.query("create schema auth; create schema app; create schema extensions; create schema supabase_migrations; create extension pgcrypto with schema extensions; create role anon; create role authenticated; create role service_role bypassrls; create table auth.users(id uuid primary key,email text,encrypted_password text); create table public.services(id serial primary key,name text,user_id uuid references auth.users); alter table public.services enable row level security; alter table public.services force row level security; create policy owner_services on public.services to authenticated using (user_id::text=current_setting('request.jwt.claim.sub',true)); grant select on public.services to authenticated; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; insert into auth.users values('11111111-1111-4111-8111-111111111111','synthetic@example.invalid','SYNTHETIC_HASH'); insert into public.services(name,user_id) values('Synthetic Service','11111111-1111-4111-8111-111111111111')");
      await exportBackup(source,path,phrase,true);const evidence=await restoreBackup(path,phrase);
      const manifest=JSON.parse(readFileSync(join(path,'manifest.json'),'utf8')),key=cipherKey(phrase,manifest.kdf.salt);
      const tampered={...manifest.files[0],sha256:'0'.repeat(64)};assert.throws(()=>decrypt(path,tampered,key));
      assert.throws(()=>authenticateManifest({...manifest,snapshot_at:'2099-01-01T00:00:00Z'},key));
      const wrong=cipherKey('wrong-synthetic-passphrase-2026',manifest.kdf.salt);assert.throws(()=>decrypt(path,manifest.files[0],wrong));wrong.fill(0);key.fill(0);
      console.log(JSON.stringify({synthetic_selftest:true,...evidence,checksum_tampering_rejected:true,manifest_timestamp_tampering_rejected:true,wrong_passphrase_rejected:true,evidence_path:path}));
    }finally{await source.stop();}
  }else if(mode==='export'){
    assert.equal(option('--authorized-project'),project,'specific_production_export_authorization_required');
    const input=await secrets(),configPath=contained(option('--config')),config=JSON.parse(readFileSync(configPath,'utf8'));
    const path=await privateDir(join(base,'production-'+Date.now()));const source=await productionSource(config,input.password);
    try{await exportBackup(source,path,input.passphrase);console.log(JSON.stringify({export_completed:true,private_run:path,restore_verified:false,production_writes:0}));}finally{await source.client.end();input.password='';input.passphrase='';}
  }else if(mode==='restore'){
    assert.ok(args.includes('--authorized-local-restore'),'specific_local_restore_authorization_required');
    const input=await secrets(),path=contained(option('--run'));const evidence=await restoreBackup(path,input.passphrase);input.passphrase='';console.log(JSON.stringify(evidence));
  }else throw new Error('mode_required');
}catch(error){
  if(mode==='prepare'||mode==='selftest')console.error(error);
  else console.error('BACKUP_RECOVERY_STOPPED: prerequisite, export or verification failed; no raw provider/row errors emitted.');
  process.exitCode=1;
}
