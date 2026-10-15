// Run with node --import tsx. Real staging requests; never production or live billing.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {mutationSchema} from '../src/lib/modules/mutations.ts';
import {existingStagingServerKey} from './staging-existing-server-key.mjs';
const project='fkpdudnnperufnmdwdlv';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const cfg=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(cfg.url,`https://${project}.supabase.co`);
const make=key=>createClient(cfg.url,key??cfg.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=make(),foreign=make(),employee=make(),admin=make(existingStagingServerKey());
const checks=[],invites=[];let product,service,user,workspace,member,finished=false,cleaned=true;
const ok=async promise=>{const r=await promise;assert.equal(r.error,null,r.error?.code);return r.data;};
const check=async(name,fn)=>{try{await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){checks.push({name,status:'FAIL',code:e.code??'assertion'});throw e;}};
const invite=async(email,role='receptionist')=>{const i=await ok(owner.rpc('create_workspace_invite',{p_workspace_id:workspace,p_role:role,p_email:email}));invites.push(i.invite_id);return i;};
try {
 for(const [c,name] of [[owner,'owner-a'],[foreign,'owner-b']])await ok(c.auth.signInWithPassword({email:`${name}@agende-staging.invalid`,password:cfg.fixture_password}));
 workspace=(await ok(owner.from('workspaces').select('id').eq('name','Staging Studio A').single())).id;
 member=(await ok(owner.from('workspace_members').select('id').eq('workspace_id',workspace).eq('user_id',(await ok(owner.auth.getUser())).user.id).single())).id;
 await check('reproduce production description constraint in staging without committing a product',async()=>{
  const r=await owner.rpc('create_inventory_product',{p_workspace_id:workspace,p_name:'P0 rejected '+randomUUID(),p_description:'D'.repeat(501)});
  assert.equal(r.error?.code,'23514');assert.match(r.error.message,/inventory_products_description_len/);
 });
 await check('corrected create and edit contracts persist at database boundaries',async()=>{
  const sku='P0-'+randomUUID();
  const input={action:'product-create',name:'N'.repeat(80),description:'D'.repeat(500),sku,unit:'unidade',minimum:'0',cost:'100.000,00',quantity:'2'};
  const v=mutationSchema.parse(input);
  product=(await ok(owner.rpc('create_inventory_product',{p_workspace_id:workspace,p_name:v.name,p_description:v.description,p_sku:v.sku,p_unit:v.unit,p_minimum_quantity:v.minimum,p_cost_cents:v.cost,p_initial_quantity:v.quantity}))).id;
  const row=await ok(owner.from('inventory_products').select('name,description,sku,cost_cents,quantity').eq('id',product).single());
  assert.equal(row.description.length,500);assert.equal(row.name.length,80);assert.equal(row.cost_cents,10000000);assert.equal(row.quantity,2);
  const edit=mutationSchema.parse({...input,action:'product-update',id:product,active:'true',name:'P0 edited '+randomUUID(),description:'',sku:'',cost:''});
  await ok(owner.rpc('update_inventory_product',{p_workspace_id:workspace,p_product_id:product,p_name:edit.name,p_description:edit.description,p_sku:edit.sku,p_cost_cents:edit.cost,p_unit:edit.unit,p_minimum_quantity:edit.minimum,p_active:edit.active}));
  const edited=await ok(owner.from('inventory_products').select('name,description,sku,cost_cents,quantity').eq('id',product).single());
  assert.equal(edited.name,edit.name);assert.equal(edited.description,null);assert.equal(edited.sku,null);assert.equal(edited.cost_cents,null);assert.equal(edited.quantity,2);
  for(const action of ['product-create','product-update'])assert.equal(mutationSchema.safeParse({...input,action,id:product,active:'true',description:'D'.repeat(501)}).success,false);
 });
 await check('stock movements persist and foreign establishment is denied',async()=>{
  for(const [p_type,p_quantity] of [['entry',3],['exit',1]])await ok(owner.rpc('apply_inventory_movement',{p_workspace_id:workspace,p_product_id:product,p_type,p_quantity}));
  await ok(owner.rpc('apply_inventory_movement',{p_workspace_id:workspace,p_product_id:product,p_type:'adjustment',p_new_quantity:0,p_reason:'P0 count'}));
  assert.equal((await ok(owner.from('inventory_products').select('quantity').eq('id',product).single())).quantity,0);
  assert.ok((await foreign.rpc('update_inventory_product',{p_workspace_id:workspace,p_product_id:product,p_name:'IDOR'})).error);
  assert.ok((await owner.rpc('apply_inventory_movement',{p_workspace_id:workspace,p_product_id:product,p_type:'exit',p_quantity:1})).error);
 });
 await check('service create edit professional links and deactivation persist',async()=>{
  const args={p_workspace_id:workspace,p_service_id:null,p_name:'P0 service '+randomUUID(),p_description:null,p_duration_minutes:30,p_price_cents:2000,p_active:true,p_professional_member_ids:[member]};
  const created=await ok(owner.rpc('save_service_with_professionals',args));
  service=typeof created==='string'?created:created.id??created.service_id;assert.ok(service);
  await ok(owner.rpc('save_service_with_professionals',{...args,p_service_id:service,p_name:'P0 edited service',p_price_cents:3000,p_active:false}));
  const row=await ok(owner.from('services').select('active,price_cents').eq('id',service).single());assert.equal(row.active,false);assert.equal(row.price_cents,3000);
  assert.equal((await ok(owner.from('professional_services').select('professional_member_id').eq('service_id',service))).length,1);
  assert.ok((await foreign.rpc('save_service_with_professionals',{...args,p_service_id:service})).error);
 });
 const email=`p0-contract-${randomUUID()}@agende-staging.invalid`,password=randomUUID()+'Aa2!';
 // Confirmed fixture intentionally bypasses SMTP; this is invitation authorization, not signup acceptance.
 user=(await ok(admin.auth.admin.createUser({email,password,email_confirm:true}))).user.id;
 await ok(employee.auth.signInWithPassword({email,password}));
 await check('invalid revoked expired email-mismatched and owner-role invitations rejected',async()=>{
  assert.equal((await employee.rpc('accept_workspace_invite',{p_token:randomUUID()})).error?.message,'invite_not_found');
  assert.ok((await owner.rpc('create_workspace_invite',{p_workspace_id:workspace,p_role:'owner',p_email:email})).error);
  const mismatch=await invite('different-'+email);assert.equal((await employee.rpc('accept_workspace_invite',{p_token:mismatch.token})).error?.message,'invite_email_mismatch');
  const revoked=await invite(email);await ok(owner.rpc('revoke_workspace_invite',{p_workspace_id:workspace,p_invite_id:revoked.invite_id}));assert.equal((await employee.rpc('accept_workspace_invite',{p_token:revoked.token})).error?.message,'invite_revoked');
  const expired=await invite(email);await ok(admin.from('workspace_invites').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',expired.invite_id));assert.equal((await employee.rpc('accept_workspace_invite',{p_token:expired.token})).error?.message,'invite_expired');
 });
 await check('existing confirmed account accepts exact role once without an individual subscription',async()=>{
  const i=await invite(email);await ok(employee.rpc('accept_workspace_invite',{p_token:i.token}));
  assert.equal((await employee.rpc('accept_workspace_invite',{p_token:i.token})).error?.message,'invite_already_accepted');
  const members=await ok(employee.from('workspace_members').select('workspace_id,role').eq('user_id',user));assert.equal(members.length,1);assert.equal(members[0].workspace_id,workspace);assert.equal(members[0].role,'receptionist');
  assert.equal((await ok(employee.from('workspaces').select('id').eq('owner_user_id',user))).length,0);
  assert.ok((await employee.rpc('create_workspace_invite',{p_workspace_id:workspace,p_role:'admin',p_email:email})).error);
 });
 await check('a second authorized invitation preserves the first membership and client area',async()=>{
  const second=(await ok(foreign.from('workspaces').select('id').eq('name','Staging Studio B').single())).id;
  const i=await ok(foreign.rpc('create_workspace_invite',{p_workspace_id:second,p_role:'receptionist',p_email:email}));invites.push(i.invite_id);
  await ok(employee.rpc('accept_workspace_invite',{p_token:i.token}));
  const members=await ok(employee.from('workspace_members').select('workspace_id,role').eq('user_id',user));
  assert.deepEqual(members.map(m=>m.workspace_id).sort(),[workspace,second].sort());assert.ok(members.every(m=>m.role==='receptionist'));
  await ok(employee.rpc('create_client_profile'));assert.equal((await ok(employee.from('workspace_members').select('id').eq('user_id',user))).length,2);
 });
 finished=true;
} finally {
 const cleanup=async fn=>{try{await fn();}catch{cleaned=false;}};
 if(product)await cleanup(()=>ok(owner.rpc('archive_inventory_product',{p_workspace_id:workspace,p_product_id:product})));
 if(service)await cleanup(()=>ok(owner.from('services').update({archived_at:new Date().toISOString(),active:false}).eq('id',service).eq('workspace_id',workspace)));
 // Only IDs generated by this run; preserve prior memberships and fixtures.
 for(const id of invites)await cleanup(()=>ok(admin.from('workspace_invites').delete().eq('id',id)));
 if(user)await cleanup(()=>ok(admin.auth.admin.deleteUser(user)));
 for(const c of [owner,foreign,employee])await c.auth.signOut({scope:'local'});
 writeFileSync('docs/staging/p0-contracts-real-20261015.json',JSON.stringify({checked_at:new Date().toISOString(),project,passed:finished&&cleaned,cleanup:cleaned,mode:'real staging Auth/PostgREST; temporary confirmed employee is an admin fixture, no SMTP proof',production_writes:0,checks},null,2)+'\n');
}
assert.ok(cleaned,'Generated fixtures require cleanup');
