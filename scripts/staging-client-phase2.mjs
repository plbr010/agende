// Real GoTrue + PostgREST on the explicit staging project. No service-role credential.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const config=JSON.parse(readFileSync(process.env.AGENDE_PHASE2_CONFIG_FILE??'.env.staging-homologation.json','utf8'));
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const make=()=>createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=make(),foreign=make(),customer=make(),anon=make();
const checks=[],restore=[];
const ok=async promise=>{const r=await promise;assert.equal(r.error,null,r.error?.message);return r.data;};
const check=async(name,fn)=>{try{await fn();checks.push({name,status:'PASS',mode:'real GoTrue/PostgREST'});console.log('PASS '+name);}catch(e){checks.push({name,status:'FAIL',error:String(e.message).slice(0,350)});console.log('FAIL '+name);}};
let clientId,foreignId,workspaces=[];
try {
 await check('confirmed independent sessions',async()=>{
  for(const [c,email] of [[owner,'owner-a'],[foreign,'owner-b'],[customer,'client']]) {
   const data=await ok(c.auth.signInWithPassword({email:email+'@agende-staging.invalid',password:config.fixture_password}));assert.ok(data.user.email_confirmed_at);
  }
  clientId=(await ok(customer.auth.getUser())).user.id;foreignId=(await ok(foreign.auth.getUser())).user.id;
  await ok(foreign.rpc('create_client_profile'));
 });
 await check('publish only existing synthetic studios using authorized settings RPC',async()=>{
  for(const [c,name] of [[owner,'Staging Studio A'],[foreign,'Staging Studio B']]) {
   const workspace=(await ok(c.from('workspaces').select('id,name,slug').eq('name',name)))[0];assert.ok(workspace);
   const settings=(await ok(c.from('workspace_settings').select('*').eq('workspace_id',workspace.id)))[0];
   const args={p_workspace_id:workspace.id,p_name:workspace.name,p_slug:workspace.slug,p_business_phone:settings.business_phone,p_business_email:settings.business_email,p_description:settings.description,p_address:settings.address,p_city:settings.city,p_state:settings.state,p_postal_code:settings.postal_code,p_instagram:settings.instagram,p_timezone:settings.timezone,p_logo_path:settings.logo_path,p_clear_logo:false};
   restore.push(async()=>{await ok(c.rpc('set_workspace_discovery',{p_workspace_id:workspace.id,p_enabled:settings.discovery_enabled}));await ok(c.rpc('update_workspace_settings',args));});
   await ok(c.rpc('update_workspace_settings',{...args,p_city:'Muriaé',p_state:'MG'}));
   await ok(c.rpc('set_workspace_discovery',{p_workspace_id:workspace.id,p_enabled:true}));
   workspaces.push({...workspace,c});
  }
 });
 if(workspaces.length===2) {
  await check('favorites add list duplicate remove persistence and cross-user denial',async()=>{
   const wid=workspaces[0].id;
   const before=await ok(customer.from('client_workspace_favorites').select('workspace_id').eq('workspace_id',wid));assert.equal(before.length,0,'runner will not remove pre-existing favorites');
   restore.push(async()=>ok(customer.rpc('remove_my_workspace_favorite',{p_workspace_id:wid})));
   for(let i=0;i<2;i++)await ok(customer.rpc('add_my_workspace_favorite',{p_workspace_id:wid}));
   let rows=await ok(customer.rpc('list_my_workspace_favorites'));assert.equal(rows.items.filter(x=>x.workspace_id===wid).length,1);
   assert.ok(!JSON.stringify(rows).includes('business_email'));
   await ok(foreign.rpc('remove_my_workspace_favorite',{p_workspace_id:wid}));
   assert.equal((await ok(foreign.from('client_workspace_favorites').select('*').eq('user_id',clientId))).length,0);
   assert.ok((await customer.from('client_workspace_favorites').insert({user_id:foreignId,workspace_id:wid})).error);
   assert.ok((await anon.rpc('list_my_workspace_favorites')).error);
   assert.ok((await customer.rpc('add_my_workspace_favorite',{p_workspace_id:randomUUID()})).error);
   await ok(customer.auth.signOut());await ok(customer.auth.signInWithPassword({email:'client@agende-staging.invalid',password:config.fixture_password}));
   rows=await ok(customer.rpc('list_my_workspace_favorites'));assert.ok(rows.items.some(x=>x.workspace_id===wid));
   await ok(customer.rpc('remove_my_workspace_favorite',{p_workspace_id:wid}));await ok(customer.rpc('remove_my_workspace_favorite',{p_workspace_id:wid}));
   assert.equal((await ok(customer.rpc('list_my_workspace_favorites'))).items.filter(x=>x.workspace_id===wid).length,0);
  });
  await check('unpublished establishment cannot be favorited',async()=>{
   const w=workspaces[1];await ok(w.c.rpc('set_workspace_discovery',{p_workspace_id:w.id,p_enabled:false}));
   assert.ok((await customer.rpc('add_my_workspace_favorite',{p_workspace_id:w.id})).error);
   await ok(w.c.rpc('set_workspace_discovery',{p_workspace_id:w.id,p_enabled:true}));
  });
 }
 await check('profile residence city persists own row; cross-user and role changes denied',async()=>{
  const before=(await ok(customer.from('profiles').select('residence_city').eq('user_id',clientId)))[0];
  restore.push(()=>ok(customer.from('profiles').update({residence_city:before.residence_city}).eq('user_id',clientId)));
  await ok(customer.from('profiles').update({residence_city:'Muriaé'}).eq('user_id',clientId));
  assert.equal((await ok(foreign.from('profiles').update({residence_city:'IDOR'}).eq('user_id',clientId).select('user_id'))).length,0);
  assert.ok((await customer.from('profiles').update({intended_use:'professional'}).eq('user_id',clientId)).error);
  assert.ok((await customer.from('profiles').update({avatar_path:'bad'}).eq('user_id',clientId)).error);
  await ok(customer.auth.signOut());await ok(customer.auth.signInWithPassword({email:'client@agende-staging.invalid',password:config.fixture_password}));
  assert.equal((await ok(customer.from('profiles').select('residence_city').eq('user_id',clientId)))[0].residence_city,'Muriaé');
 });
 await check('private Storage rejects direct uploads signing and privileged avatar RPC',async()=>{
  const path=`avatars/${foreignId}/${randomUUID()}.webp`;
  assert.ok((await customer.storage.from('account-avatars').upload(path,new Uint8Array([0]),{contentType:'image/webp'})).error);
  assert.ok((await customer.storage.from('account-avatars').createSignedUrl(path,60)).error);
  assert.ok((await customer.rpc('swap_account_avatar',{p_user_id:foreignId,p_expected_path:null,p_new_path:path})).error);
 });
 await check('history is authenticated and foreign appointment cancellation/review is denied',async()=>{
  const rows=await ok(customer.rpc('list_my_appointments'));assert.ok(rows.length,'existing synthetic history required');
  for(const row of rows) {assert.ok(row.id);assert.equal(typeof row.price_cents,'number');assert.ok(row.status);}
  const foreignRows=await ok(foreign.rpc('list_my_appointments'));
  assert.ok(!foreignRows.some(x=>rows.some(y=>x.id===y.id)));
  assert.ok((await foreign.rpc('cancel_my_appointment',{p_appointment_id:rows[0].id})).error);
  assert.ok((await foreign.rpc('submit_appointment_review',{p_appointment_id:rows[0].id,p_rating:5,p_comment:'IDOR'})).error);
 });
} finally {
 for(const fn of restore.reverse())try{await fn();}catch(e){checks.push({name:'restore synthetic fixture state',status:'FAIL',error:String(e.message).slice(0,250)});}
 writeFileSync('docs/staging/client-phase2-real-tests.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',production_touched:false,out_of_scope:['avatar HTTP acceptance: separate staging-avatar-http runner','browser draft acceptance: separate staging-booking-draft-browser runner'],checks},null,2)+'\n');
}
if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
