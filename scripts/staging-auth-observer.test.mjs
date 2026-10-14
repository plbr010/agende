import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
const observer=new URL('./staging-auth-observer.mjs',import.meta.url).href;
const env={...process.env,AGENDE_AUTH_OBSERVER:'fkpdudnnperufnmdwdlv',NEXT_PUBLIC_SUPABASE_URL:'https://fkpdudnnperufnmdwdlv.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-key'};
test('local observer emits only safe PKCE metadata and canonical redirects, never credentials',async()=>{
 const script=`const http=require('node:http');const server=http.createServer((req,res)=>{res.setHeader('location','http://localhost:3000/onboarding');res.writeHead(307);res.end();});server.listen(0,'127.0.0.1',async()=>{await fetch('http://127.0.0.1:'+server.address().port+'/auth/callback?code=synthetic-secret-code',{redirect:'manual',headers:{cookie:'sb-fkpdudnnperufnmdwdlv-auth-token-code-verifier=synthetic-secret-verifier'}});server.close(()=>process.disconnect());});`;
 const child=spawn(process.execPath,['--import',observer,'--input-type=commonjs','-e',script],{env,stdio:['ignore','ignore','pipe','ipc']});
 let error='';child.stderr.on('data',c=>{error+=c;});const observations=[];child.on('message',m=>observations.push(m.observation));
 assert.equal(await new Promise(resolve=>child.once('exit',resolve)),0,error);
 assert.equal(observations.length,1);
 assert.equal(observations[0].has_pkce_code,true);assert.equal(observations[0].has_pkce_verifier_cookie,true);
 assert.equal(observations[0].same_origin_redirect,true);assert.equal(observations[0].destination,'/onboarding');
 assert.doesNotMatch(JSON.stringify(observations),/synthetic-secret|code=|cookie=|access_token|refresh_token/);
});
test('observer refuses production and requires explicit staging opt-in',async()=>{
 for(const override of [{AGENDE_AUTH_OBSERVER:''},{NEXT_PUBLIC_SUPABASE_URL:'https://wohimauqgywshbbejjcl.supabase.co'}]){
 const child=spawn(process.execPath,['--import',observer,'-e','process.exit(0)'],{env:{...env,...override},stdio:'ignore'});
 assert.notEqual(await new Promise(resolve=>child.once('exit',resolve)),0);
 }
});
