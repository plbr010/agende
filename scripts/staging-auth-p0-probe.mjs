// Production is GET-only and uses fresh anonymous browser contexts.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const fixture=JSON.parse(readFileSync('.env.final-auth-owned-fixture.json','utf8'));
const checks=[],record=(name,details={})=>{checks.push({name,status:'PASS',...details});console.log('PASS '+name);};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP localhost [::1]']});
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','::1','--port','3000'],{windowsHide:true,stdio:'ignore',env:{...process.env,SITE_URL:'http://localhost:3000',NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key}});
try {
  for(let i=0;i<60;i++){try{if((await fetch('http://[::1]:3000/login')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  for(const origin of ['https://agendeapp.online','http://localhost:3000']) {
    const context=await browser.newContext();
    // Guard against accidental production form submissions or API writes.
    if(origin.startsWith('https:'))await context.route('**/*',route=>route.request().method()==='GET'?route.continue():route.abort());
    const page=await context.newPage();
    for(const path of ['/login','/cadastro']) {
      const response=await page.goto(origin+path);
      assert.equal(response.status(),200);
      assert.equal(await page.locator('input[name=password]').count()>0,true);
      await page.reload();assert.equal(await page.locator('input[name=password]').count()>0,true);
      const rsc=await context.request.get(origin+path+'?_rsc=p0probe',{headers:{RSC:'1'}});
      assert.equal(rsc.status(),200);assert.ok(!(await rsc.text()).includes('2201433306'));
      record(`${origin} ${path}: incognito, reload and anonymous RSC`);
    }
    await context.close();
  }
  const api=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
  const signed=await api.auth.signInWithPassword({email:fixture.email,password:fixture.password});
  assert.equal(signed.error,null);
  // Deliberately stale cookie, not proof of natural GoTrue JWT expiration.
  const session={...signed.data.session,expires_at:1,expires_in:0,refresh_token:'invalid-expired-test-refresh'};
  const context=await browser.newContext();
  await context.addCookies([{name:'sb-fkpdudnnperufnmdwdlv-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:'http://localhost:3000',sameSite:'Lax'}]);
  const page=await context.newPage();
  await page.goto('http://localhost:3000/app');
  await page.waitForURL('**/login?next=**');
  assert.equal(await page.locator('input[name=password]').count(),1);
  await page.goto('http://localhost:3000/cadastro');
  assert.equal(await page.locator('input[name=password]').count(),1);
  record('staging stale expiration cookie with invalid refresh fails closed and public forms remain usable',{method:'fault injection, real SSR and real GoTrue; natural expiry not repeated'});
  await context.close();await api.auth.signOut({scope:'local'});
} finally {
  await browser.close();server.kill();
  writeFileSync('docs/staging/auth-p0-browser-20261015.json',JSON.stringify({checked_at:new Date().toISOString(),checks},null,2)+'\n');
}
