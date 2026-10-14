// Real invite/accept RPCs on paid TEST workspaces. Accounts are confirmed SQL
// fixtures prepared in staging; this does not homologate email confirmation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const c=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(c.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const links=JSON.parse(readFileSync('.test-postgres/staging-billing-links.json','utf8')).links;
const make=()=>createClient(c.url,c.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=make(),actors=[],checks=[];
const ok=async p=>{const r=await p;if(r.error)throw new Error('staging_seat_request_failed');return r.data;};
try{
 await ok(owner.auth.signInWithPassword({email:'owner-a@agende-staging.invalid',password:c.fixture_password}));
 for(let n=1;n<=14;n++){
  const client=make(),email='billing-seat-'+String(n).padStart(2,'0')+'@agende-staging.invalid';
  const login=await ok(client.auth.signInWithPassword({email,password:c.fixture_password}));
  actors.push({client,email,id:login.user.id});
 }
 for(const [plan,limit] of [['solo',1],['equipe',5],['salao',15]]){
  const x=links.find(x=>x.plan===plan&&x.interval==='annual');assert.ok(x);
  for(const actor of actors.slice(0,limit-1)){
   const exists=await ok(owner.from('workspace_members').select('id').eq('workspace_id',x.workspace_id).eq('user_id',actor.id));
   if(!exists.length){
    const invite=await ok(owner.rpc('create_workspace_invite',{p_workspace_id:x.workspace_id,p_role:'professional',p_email:actor.email}));
    await ok(actor.client.rpc('accept_workspace_invite',{p_token:invite.token}));
   }
  }
  const seats=await ok(owner.from('workspace_members').select('id').eq('workspace_id',x.workspace_id).eq('status','active').in('role',['owner','admin','professional']));assert.equal(seats.length,limit);
  const excess=await owner.rpc('create_workspace_invite',{p_workspace_id:x.workspace_id,p_role:'professional',p_email:'billing-over-limit@agende-staging.invalid'});
  assert.ok(excess.error);assert.match(excess.error.message,/plan_professional_limit_reached/);
  checks.push({plan,workspace_id:x.workspace_id,paid_status:'active',active_professionals:limit,extra_professional_denied:true,result:'PASS'});
  console.log('PASS real paid TEST seat limit '+plan+' '+limit);
 }
}finally{
 writeFileSync('docs/staging/billing-seat-limits.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',livemode:false,status:checks.length===3?'PASS':'FAIL',checks,auth_accounts:'confirmed synthetic SQL fixtures; not email acceptance',production_changed:false,secrets_in_report:false},null,2)+'\n');
 await Promise.all([owner,...actors.map(a=>a.client)].map(x=>x.auth.signOut({scope:'local'})));
}
