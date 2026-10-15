// Inspects only public assets from the Vercel-verified staging Preview.
// Existing staging server credential is compared in memory and never output.
import assert from 'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';import{existingStagingServerKey}from'./staging-existing-server-key.mjs';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const origin='https://agende-lme3386lk-pedros-projects-cfddfd39.vercel.app',checks=[];
try{
 const secret=existingStagingServerKey(),claims=JSON.parse(Buffer.from(secret.split('.')[1],'base64url'));assert.equal(claims.ref,'fkpdudnnperufnmdwdlv');assert.equal(claims.role,'service_role');
 const response=await fetch(origin+'/login');assert.equal(response.status,200);const html=await response.text();assert.ok(!html.includes(secret));
 const urls=[...new Set([...html.matchAll(/src="([^"<>]*\/_next\/static\/[^"<>]*\.js[^"<>]*)"/g)].map(x=>new URL(x[1].replaceAll('&amp;','&'),origin).href))];assert.ok(urls.length>0);
 let stage=false;
 for(const url of urls){assert.equal(new URL(url).origin,origin);const asset=await fetch(url);assert.equal(asset.status,200);const body=await asset.text();assert.ok(!body.includes(secret),'Server credential must not enter browser assets');assert.ok(!body.includes('https://wohimauqgywshbbejjcl.supabase.co'),'Production build forbidden');stage ||= body.includes('https://fkpdudnnperufnmdwdlv.supabase.co');}
 // Forms may call only server actions, so a public Supabase URL is optional.
 const proof=JSON.parse(readFileSync('docs/staging/stabilization-preview-avatar-http.json','utf8'));assert.equal(proof.origin,origin);assert.equal(proof.project,'fkpdudnnperufnmdwdlv');assert.ok(proof.checks.length>=6&&proof.checks.every(x=>x.status==='PASS'));
 checks.push({status:'PASS',public_javascript_assets:urls.length,server_credential_exposed:false,staging_url_in_public_assets:stage,staging_backend_proof:'real Preview avatar HTTP Auth/Storage suite'});console.log('PASS Preview public assets exclude server credential; staging backend verified by real avatar HTTP suite');
}catch(e){writeFileSync('.env.final-boundary-error.txt',String(e.stack));checks.push({status:'FAIL',detail:'Private diagnostics withheld'});process.exitCode=1;}finally{
 writeFileSync('docs/staging/final-preview-credential-boundary-20261015.json',JSON.stringify({checked_at:new Date().toISOString(),origin,project:'fkpdudnnperufnmdwdlv',production_writes:0,secrets_in_report:false,checks},null,2)+'\n');
}
