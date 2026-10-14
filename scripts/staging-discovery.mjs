// Mutates only existing synthetic staging fixtures; restores publication/locality.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const make=()=>createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const guest=make(),checks=[],fixtures=[];
const ok=async promise=>{const r=await promise;assert.equal(r.error,null,r.error?.message);return r.data;};
const search=(args={})=>ok(guest.rpc('search_public_workspaces',{p_city:null,p_state:null,p_query:'Staging Studio',p_postal_code:null,p_limit:20,p_offset:0,...args}));
let restored=true;
try{
  for(const [identity,name] of [['owner-a','Staging Studio A'],['owner-b','Staging Studio B']]){
    const client=make();await ok(client.auth.signInWithPassword({email:identity+'@agende-staging.invalid',password:config.fixture_password}));
    const w=(await ok(client.from('workspaces').select('id,name,slug').eq('name',name)))[0];assert.ok(w);
    const s=await ok(client.from('workspace_settings').select('city,state').eq('workspace_id',w.id).single());
    const enabled=await ok(client.rpc('get_workspace_discovery',{p_workspace_id:w.id}));
    fixtures.push({client,w,s,enabled});
    await ok(client.rpc('set_workspace_discovery',{p_workspace_id:w.id,p_enabled:false}));
    await ok(client.rpc('update_workspace_settings',{p_workspace_id:w.id,p_name:w.name,p_slug:w.slug,p_city:'São Paulo',p_state:'SP'}));
  }
  assert.equal((await search()).total,0);checks.push('unpublished fixtures absent');
  for(const f of fixtures)await ok(f.client.rpc('set_workspace_discovery',{p_workspace_id:f.w.id,p_enabled:true}));
  const result=await search();assert.equal(result.total,2);
  assert.deepEqual(Object.keys(result.items[0]).sort(),['booking_open','city','description','logo_path','name','slug','state'].sort());
  checks.push('real public contract exposes only approved fields');
  const first=await search({p_city:'sao paulo',p_query:null,p_limit:1}),second=await search({p_city:'sao paulo',p_query:null,p_limit:1,p_offset:1});
  assert.equal(first.total,2);assert.notEqual(first.items[0].slug,second.items[0].slug);checks.push('accent-insensitive city and distinct pages');
  assert.equal((await search({p_city:'Salvador',p_query:null})).total,0);checks.push('any city without residence restriction or invented results');
  const places=await ok(guest.rpc('list_public_localities',{p_query:'sao',p_state:'SP',p_limit:8}));
  assert.equal(places.localities.find(x=>x.city==='São Paulo').workspace_count,2);checks.push('locality suggestions count only eligible published establishments');
  assert.ok((await fixtures[1].client.rpc('set_workspace_discovery',{p_workspace_id:fixtures[0].w.id,p_enabled:false})).error);
  assert.ok((await guest.from('workspace_settings').select('business_email')).error);checks.push('cross-tenant publication denied and private table hidden');
  await ok(fixtures[0].client.rpc('set_workspace_discovery',{p_workspace_id:fixtures[0].w.id,p_enabled:false}));
  assert.equal((await search()).total,1);checks.push('withdrawal immediately removes public listing');
  console.log(JSON.stringify({passed:true,checks}));
}finally{
  for(const f of fixtures){try{
    await ok(f.client.rpc('set_workspace_discovery',{p_workspace_id:f.w.id,p_enabled:false}));
    await ok(f.client.rpc('update_workspace_settings',{p_workspace_id:f.w.id,p_name:f.w.name,p_slug:f.w.slug,p_city:f.s.city,p_state:f.s.state}));
    if(f.enabled)await ok(f.client.rpc('set_workspace_discovery',{p_workspace_id:f.w.id,p_enabled:true}));
  }catch{restored=false;}finally{await f.client.auth.signOut();}}
  writeFileSync('docs/staging/discovery-real-api.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',checks,passed:checks.length===7&&restored,fixtures_restored:restored,production_connections:0,secrets_in_report:false},null,2)+'\n');
  assert.equal(restored,true,'Staging fixture restoration failed');
}
