import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { nativeTestConfig } from './native-test-database.mjs';
import { checkEnvironmentIsolation } from './environment-isolation.mjs';

test('native SQL harness ignores remote connection variables and requires an owned test directory',()=>{
  const config=nativeTestConfig({AGENDE_NATIVE_PG_PORT:'55555',AGENDE_NATIVE_PG_DATA:resolve('.test-postgres/run-safety/data'),PGHOST:'production.invalid',DATABASE_URL:'postgres://production.invalid/database'});
  assert.equal(config.host,'127.0.0.1');assert.equal(config.ssl,false);
  for(const value of ['', 'NaN', '0', '65536', '55555;delete'])assert.throws(()=>nativeTestConfig({AGENDE_NATIVE_PG_PORT:value,AGENDE_NATIVE_PG_DATA:resolve('.test-postgres/run-safety/data')}));
  assert.throws(()=>nativeTestConfig({AGENDE_NATIVE_PG_PORT:'55555',AGENDE_NATIVE_PG_DATA:resolve('supabase')}));
});
const entry=(database,site,mode)=>({supabaseUrl:database,siteOrigin:site,stripeMode:mode,authRedirects:['/auth/callback','/auth/confirm','/auth/recovery'].map(path=>site+path)});
test('isolation policy rejects the shared production database observed on Vercel',()=>{
  const matrix={production:entry('https://prod.supabase.co','https://agende.example','live'),preview:entry('https://prod.supabase.co','https://preview.vercel.app','test'),development:entry('https://prod.supabase.co','http://127.0.0.1:3000','test')};
  const result=checkEnvironmentIsolation(matrix);assert.equal(result.configurationPolicyPassed,false);assert.equal(result.errors.filter(error=>error.includes('shared database')).length,3);
});
test('valid separate configuration never claims external Auth or payments were tested',()=>{
  const matrix={production:entry('https://prod.supabase.co','https://agende.example','live'),preview:entry('https://stage.supabase.co','https://preview.vercel.app','test'),development:entry('http://127.0.0.1:54321','http://127.0.0.1:3000','test')};
  assert.deepEqual(checkEnvironmentIsolation(matrix),{configurationPolicyPassed:true,errors:[],externalFlowsVerified:false});
  matrix.preview.stripeMode='live';matrix.preview.authRedirects=[];
  const invalid=checkEnvironmentIsolation(matrix);assert.equal(invalid.configurationPolicyPassed,false);assert.equal(invalid.errors.length,4);
});
