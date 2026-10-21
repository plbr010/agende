import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {createServerClient} from '@supabase/ssr';
import {chromium} from 'playwright';
import {existingStagingServerKey} from './staging-existing-server-key.mjs';
const project='fkpdudnnperufnmdwdlv',origin='http://localhost:3109';assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const read=p=>JSON.parse(readFileSync(p,'utf8')),c=read('.env.staging-homologation.json'),f=read('.env.profiles-media-final20-fixtures.json');assert.equal(c.url,`https://${project}.supabase.co`);
const metrics=[],clients=[];let browser;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','::1','--port','3109'],{windowsHide:true,stdio:'ignore',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:c.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:c.publishable_key,SUPABASE_SERVICE_ROLE_KEY:existingStagingServerKey(),SITE_URL:origin,NEXT_PUBLIC_SITE_URL:origin}});
try{
 for(let n=0;n<100;n++){try{if((await fetch('http://[::1]:3109/login')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP localhost [::1]']});
 for(const [role,paths] of [['public',['/','/descobrir?modo=city&cidade=Juiz%20de%20Fora&uf=MG','/p/'+f.professional.slug]],['professional',['/app/agenda']],['client',['/cliente/agendamentos']]]){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  if(role!=='public'){
   const jar=new Map(),client=createServerClient(c.url,c.publishable_key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(x=>jar.set(x.name,x.value))}});
   const signed=await client.auth.signInWithPassword(f[role]);assert.ok(!signed.error);clients.push(client);await context.addCookies([...jar].map(([name,value])=>({name,value,url:origin,httpOnly:true,sameSite:'Lax'})));
  }
  const page=await context.newPage();
  for(const path of paths)for(let sample=0;sample<3;sample++){
   const start=performance.now(),response=await page.goto(origin+path);assert.equal(response.status(),200);await page.locator('main').waitFor();
   metrics.push({role,path,sample,navigation_wall_ms:Math.round(performance.now()-start),...await page.evaluate(()=>{
    const n=performance.getEntriesByType('navigation')[0],r=performance.getEntriesByType('resource');return {ttfb_ms:Math.round(n.responseStart-n.requestStart),dom_ms:Math.round(n.domContentLoadedEventEnd),horizontal_overflow:document.documentElement.scrollWidth>innerWidth,js_requests:r.filter(x=>x.name.includes('.js')).length,js_encoded_bytes:r.filter(x=>x.name.includes('.js')).reduce((s,x)=>s+x.encodedBodySize,0),image_requests:r.filter(x=>x.initiatorType==='img').length};
   })});
  }
  await context.close();
 }
}catch(e){metrics.push({status:'FAIL',code:e.name});process.exitCode=1;}
finally{
 await browser?.close();server.kill();for(const client of clients)await client.auth.signOut({scope:'local'});
 const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):e.name.endsWith('.js')?[dir+'/'+e.name]:[]),js=files('.next/static');
 writeFileSync('docs/homologation/adv20-performance.json',JSON.stringify({checked_at:new Date().toISOString(),project,production_writes:0,mode:'local production build + real staging, Edge mobile 390px, 3 samples per route, no throttling',limits:'Not real-user production percentiles or a capacity benchmark. Local cold/warm and network effects are mixed. Encoded resource bytes can be zero with browser caching. All chunk sizes are inventory, not initial route payload.',chunk_inventory:{files:js.length,bytes:js.reduce((s,p)=>s+statSync(p).size,0),gzip_bytes:js.reduce((s,p)=>s+gzipSync(readFileSync(p)).length,0)},metrics},null,2)+'\n');
}
