// Uses the existing CLI-authenticated staging service key in process memory only.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {existingStagingServerKey} from './staging-existing-server-key.mjs';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const config=JSON.parse(readFileSync(process.env.AGENDE_PHASE2_CONFIG_FILE??'.env.staging-homologation.json','utf8'));
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const serverKey=existingStagingServerKey();
const admin=createClient(config.url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const preview=process.env.AGENDE_AVATAR_PREVIEW_ORIGIN;
if(preview)assert.ok([
 'https://agende-git-codex-stabilization-38c7eb-pedros-projects-cfddfd39.vercel.app',
 // Vercel API verified: project agende, final acceptance branch, commit 6bedaf6.
 'https://agende-lme3386lk-pedros-projects-cfddfd39.vercel.app',
].includes(preview),'Only explicitly verified staging Previews are allowed');
const origin=preview??`http://127.0.0.1:${port}`,checks=[];
const server=preview?null:spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{windowsHide:true,stdio:'ignore',env:{...process.env,SUPABASE_SERVICE_ROLE_KEY:serverKey,SITE_URL:origin,NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key,NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV:'staging',NEXT_PUBLIC_SITE_URL:origin}});
const login=async(email)=>{
 const jar=new Map();const client=createServerClient(config.url,config.publishable_key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
 const {data,error}=await client.auth.signInWithPassword({email:email+'@agende-staging.invalid',password:config.fixture_password});assert.equal(error,null);
 return {client,user:data.user,header:()=>[...jar].map(([n,v])=>`${n}=${v}`).join('; ')};
};
let account,professionalAccount,changed=false,professionalChanged=false;
const request=(session,method='GET',body,extra={})=>fetch(origin+'/api/account/avatar',{method,body,headers:{...(session?{cookie:session.header()}:{}),...(method==='GET'?{}:{origin}),...extra}});
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS',mode:preview?'real Vercel Preview HTTP + staging Auth/Storage/PostgREST':'real local Next HTTP + staging Auth/Storage/PostgREST'});console.log('PASS '+name);};
try{
 for(let n=0;n<40;n++){try{if((await fetch(origin+'/api/account/avatar')).status===401)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 account=await login('client');const other=await login('owner-b');professionalAccount=other;
 const {data:profile}=await account.client.from('profiles').select('avatar_path').eq('user_id',account.user.id).single();assert.equal(profile.avatar_path,null,'never replace existing personal photo in a test');
 await check('no photo returns 204; unauthenticated read denied; CSRF denied',async()=>{
  assert.equal((await request(account)).status,204);assert.equal((await request(null)).status,401);
  assert.equal((await request(account,'PUT',Buffer.from('bad'),{origin:'https://attacker.invalid'})).status,403);
 });
 await check('invalid SVG corrupt and oversized uploads rejected',async()=>{
  for(const data of [Buffer.from('<svg/>'),Buffer.from([255,216,255])])assert.equal((await request(account,'PUT',data)).status,422);
  assert.equal((await request(account,'PUT',Buffer.alloc(5*1024*1024+1))).status,413);
 });
 let oldPath;
 await check('valid upload persisted normalized private photo with authorized proxy',async()=>{
  const image=await sharp({create:{width:120,height:120,channels:3,background:'red'}}).jpeg().toBuffer();
  assert.equal((await request(account,'PUT',image)).status,200);changed=true;
  const {data:p}=await account.client.from('profiles').select('avatar_path').eq('user_id',account.user.id).single();oldPath=p.avatar_path;assert.ok(oldPath.startsWith('avatars/'+account.user.id+'/'));
  const response=await request(account);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format,'webp');
  assert.equal((await request(other)).status,204);
  assert.ok((await other.client.storage.from('account-avatars').download(oldPath)).error);
  assert.ok((await other.client.storage.from('account-avatars').createSignedUrl(oldPath,60)).error);
 });
 await check('replacement deletes old bytes and survives new login',async()=>{
  const image=await sharp({create:{width:100,height:100,channels:3,background:'blue'}}).webp().toBuffer();
  assert.equal((await request(account,'PUT',image)).status,200);
  const listed=await admin.storage.from('account-avatars').list(`avatars/${account.user.id}`);
  assert.equal(listed.error,null);assert.ok(!listed.data.some(x=>x.name===oldPath.split('/').at(-1)));
  account=await login('client');assert.equal((await request(account)).status,200);
 });
 await check('removal clears reference and Storage and returns initials fallback',async()=>{
  const {data:p}=await account.client.from('profiles').select('avatar_path').eq('user_id',account.user.id).single();
  assert.equal((await request(account,'DELETE')).status,200);changed=false;
  assert.equal((await request(account)).status,204);
  const listed=await admin.storage.from('account-avatars').list(`avatars/${account.user.id}`);
  assert.equal(listed.error,null);assert.ok(!listed.data.some(x=>x.name===p.avatar_path.split('/').at(-1)));
  assert.equal((await account.client.from('profiles').select('avatar_path').eq('user_id',account.user.id).single()).data.avatar_path,null);
 });
 await check('professional account uses same private upload and read contract independently',async()=>{
  const before=(await other.client.from('profiles').select('avatar_path').eq('user_id',other.user.id).single()).data;
  assert.equal(before.avatar_path,null,'never replace an existing professional photo in a test');
  const image=await sharp({create:{width:80,height:80,channels:3,background:'green'}}).png().toBuffer();
  assert.equal((await request(other,'PUT',image)).status,200);professionalChanged=true;
  assert.equal((await request(other)).status,200);assert.equal((await request(account)).status,204);
  assert.equal((await request(other,'DELETE')).status,200);professionalChanged=false;
 });
} catch(e){checks.push({name:'avatar HTTP acceptance',status:'FAIL',error:String(e.message).slice(0,400)});process.exitCode=1;console.log('FAIL avatar HTTP acceptance');}
finally {
 if(changed&&account)await request(account,'DELETE');
 if(professionalChanged&&professionalAccount)await request(professionalAccount,'DELETE');
 server?.kill();
 writeFileSync(preview?'docs/staging/stabilization-preview-avatar-http.json':'docs/staging/client-phase2-avatar-http.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',origin,production_touched:false,secrets_modified:false,checks},null,2)+'\n');
}
