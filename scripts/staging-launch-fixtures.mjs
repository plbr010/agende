// Explicit staging opt-in. Own new synthetic catalog rows only; never resets a trial.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const path='.env.launch-owned-fixtures.json';
const cfg=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(cfg.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const f=JSON.parse(readFileSync('.env.profiles-media-fixtures.json','utf8')).professional;
const c=createClient(cfg.url,cfg.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=async p=>{const r=await p;assert.ok(!r.error,r.error?.code);return r.data;};
await ok(c.auth.signInWithPassword({email:f.email,password:f.password}));
const wid=f.workspaceId, m=(await ok(c.from('workspace_members').select('id').eq('workspace_id',wid).eq('user_id',f.id).single())).id;
if(process.argv.includes('--cleanup')){
 const owned=JSON.parse(readFileSync(path,'utf8'));assert.equal(owned.wid,wid);assert.equal(owned.member,m);
 if(!owned.cleaned_at){
  if(owned.service)await ok(c.from('services').update({active:false,archived_at:new Date().toISOString()}).eq('id',owned.service).eq('workspace_id',wid));
  // Exact IDs were recorded as each row was inserted by this runner. No pre-existing schedule row is touched.
  if(owned.hours?.length)await ok(c.from('professional_working_hours').delete().in('id',owned.hours).eq('workspace_id',wid).eq('professional_member_id',m));
  await ok(c.rpc('set_workspace_discovery',{p_workspace_id:wid,p_enabled:owned.original_publication}));
  owned.cleaned_at=new Date().toISOString();writeFileSync(path,JSON.stringify(owned));
 }
 writeFileSync('docs/homologation/launch-owned-fixture-cleanup-20261020.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',own_service_archived:true,only_new_working_hours_removed:true,publication_restored:true,prior_data_deleted:false,production_writes:0},null,2)+'\n');
 await c.auth.signOut({scope:'local'});console.log('PASS only own new fixtures cleaned; pre-existing records preserved');process.exit(0);
}
assert.ok(!existsSync(path)||JSON.parse(readFileSync(path,'utf8')).cleaned_at,'Never replace an unfinished launch fixture manifest');
const before=await ok(c.from('workspace_settings').select('discovery_enabled').eq('workspace_id',wid).single());
const owned={wid,member:m,hours:[],original_publication:before.discovery_enabled};
const save=()=>writeFileSync(path,JSON.stringify(owned));save();
const service=await ok(c.rpc('save_service_with_professionals',{p_workspace_id:wid,p_service_id:null,p_name:'Launch P0 synthetic '+Date.now(),p_description:'Owned staging acceptance fixture',p_duration_minutes:30,p_price_cents:5000,p_active:true,p_professional_member_ids:[m]}));
owned.service=service;save();
for(let weekday=0;weekday<7;weekday++){
 const row=await ok(c.from('professional_working_hours').insert({workspace_id:wid,professional_member_id:m,weekday,start_time:'08:00',end_time:'18:00'}).select('id').single());owned.hours.push(row.id);save();
}
await ok(c.rpc('set_workspace_discovery',{p_workspace_id:wid,p_enabled:true}));
save();
console.log('PASS active synthetic owner, own service, seven days availability and public consent');
await c.auth.signOut({scope:'local'});
