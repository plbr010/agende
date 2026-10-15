import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const cfg=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(cfg.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const fixture=JSON.parse(readFileSync('.env.profiles-media-fixtures.json','utf8')).professional;
const client=createClient(cfg.url,cfg.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=async p=>{const r=await p;assert.equal(r.error,null,r.error?.code);return r.data;};
const checks=[];let original,originalWorkspace,restored=false;
try {
  await ok(client.auth.signInWithPassword(fixture));
  const w=await ok(client.from('workspaces').select('name,slug').eq('id',fixture.workspaceId).single());
  originalWorkspace=w;
  original=await ok(client.from('workspace_settings').select('*').eq('workspace_id',fixture.workspaceId).single());
  const args={p_workspace_id:fixture.workspaceId,p_name:w.name,p_slug:w.slug,p_logo_path:null,p_clear_logo:false};
  await ok(client.rpc('update_workspace_settings',args));
  const blank=await ok(client.from('workspace_settings').select('*').eq('workspace_id',fixture.workspaceId).single());
  for(const field of ['business_phone','business_email','address','city','state','postal_code'])assert.equal(blank[field],null);
  assert.equal(blank.timezone,'America/Sao_Paulo');checks.push({name:'omitted optional commercial fields really persist as null',status:'PASS'});
  for(const [field,value,code] of [['p_state','ZZ','invalid_state'],['p_timezone','Mars/Nowhere','invalid_timezone'],['p_postal_code','abc','invalid_postal_code'],['p_business_phone','123','invalid_phone']]){
    const r=await client.rpc('update_workspace_settings',{...args,p_name:'Should not commit',[field]:value});assert.equal(r.error?.message,code);
    assert.equal((await ok(client.from('workspaces').select('name').eq('id',fixture.workspaceId).single())).name,w.name);
  }checks.push({name:'invalid UF/timezone/CEP/phone rejected without partial name update',status:'PASS'});
  await ok(client.rpc('update_workspace_settings',{...args,p_business_phone:original.business_phone,p_business_email:original.business_email,p_address:original.address,p_city:original.city,p_state:original.state,p_postal_code:original.postal_code,p_description:original.description,p_instagram:original.instagram,p_timezone:original.timezone}));restored=true;
} finally {
  if(original&&!restored){await ok(client.rpc('update_workspace_settings',{p_workspace_id:fixture.workspaceId,p_name:originalWorkspace.name,p_slug:originalWorkspace.slug,p_business_phone:original.business_phone,p_business_email:original.business_email,p_address:original.address,p_city:original.city,p_state:original.state,p_postal_code:original.postal_code,p_description:original.description,p_instagram:original.instagram,p_timezone:original.timezone,p_logo_path:null,p_clear_logo:false}));restored=true;}
  await client.auth.signOut({scope:'local'});
  writeFileSync('docs/staging/profiles-settings-real-20261015.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',passed:checks.length===2&&restored,fixture_restored:restored,checks},null,2)+'\n');
}
console.log(JSON.stringify({passed:checks.length===2&&restored,checks:checks.length,fixture_restored:restored}));
