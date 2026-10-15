// Natural JWT expiry and real refresh; no clock/JWT/Auth configuration changes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {isExpiredAccessRejection} from './staging-auth-expiry-result.mjs';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
assert.ok(process.env.AGENDE_AUTH_FIXTURE_FILE,'Confirmed synthetic fixture required');
const source=JSON.parse(readFileSync(process.env.AGENDE_AUTH_FIXTURE_FILE,'utf8'));
const fixture=source.professional??source;
const client=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const path='docs/staging/final-session-20261015.json',checks=[];
const report={project:'fkpdudnnperufnmdwdlv',mode:'real GoTrue; natural JWT expiry; no clock or token edits',status:'RUNNING',checks};
const save=()=>writeFileSync(path,JSON.stringify({...report,checked_at:new Date().toISOString()},null,2)+'\n');
const pass=name=>{checks.push({name,status:'PASS'});save();console.log('PASS '+name);};
try {
 const login=await client.auth.signInWithPassword({email:fixture.email,password:fixture.password});
 assert.equal(login.error,null);assert.ok(login.data.user.email_confirmed_at);
 const original=login.data.session;
 const claims=JSON.parse(Buffer.from(original.access_token.split('.')[1],'base64url'));
 assert.equal(claims.iss,config.url+'/auth/v1');
 report.issued_at=claims.iat;report.expires_at=claims.exp;report.lifetime_seconds=claims.exp-claims.iat;
 pass('confirmed real login creates session');
 console.log('WAITING natural JWT expiry; lifetime_seconds='+report.lifetime_seconds);
 while(Date.now()/1000<claims.exp+3)await new Promise(r=>setTimeout(r,Math.min(30000,Math.max(1,(claims.exp+3)*1000-Date.now()))));
 const expired=await fetch(config.url+'/auth/v1/user',{headers:{apikey:config.publishable_key,authorization:'Bearer '+original.access_token}});
 const rejection=await expired.json();
 assert.ok(isExpiredAccessRejection(expired.status,rejection));
 report.expired_access_http_status=expired.status;report.expired_access_error_code=rejection.error_code??rejection.code;
 pass('unchanged original JWT rejected after actual expiry');
 const refreshed=await client.auth.refreshSession({refresh_token:original.refresh_token});
 assert.equal(refreshed.error,null);assert.ok(refreshed.data.session);assert.notEqual(refreshed.data.session.access_token,original.access_token);
 assert.ok(refreshed.data.session.expires_at>Date.now()/1000);
 assert.equal((await client.auth.getUser()).data.user.id,login.data.user.id);
 pass('real refresh renews expired access token and preserves identity');
 assert.equal((await client.auth.signOut({scope:'local'})).error,null);
 assert.equal((await client.auth.getSession()).data.session,null);pass('logout clears renewed session');
 report.status='PASS';save();
} catch {
 report.status='FAIL';checks.push({name:'session lifecycle',status:'FAIL',detail:'Diagnostics withheld to avoid credentials/session leakage'});save();process.exitCode=1;
}
