// Actual PostgREST operations with synthetic inventory, package and appointment.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(config.url,'https://fkpdudnnperufnmdwdlv.supabase.co');
const make=()=>createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=make(),foreign=make(),customer=make(),guest=make(),checks=[];
const ok=async p=>{const r=await p;assert.equal(r.error,null,r.error?.message);return r.data;};
let wid,product,pack,sale,appointment,redemption,failure,cleanup=true,completed=false;
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
try{
  for(const [client,email] of [[owner,'owner-a'],[foreign,'owner-b'],[customer,'client']])await ok(client.auth.signInWithPassword({email:email+'@agende-staging.invalid',password:config.fixture_password}));
  const w=(await ok(owner.from('workspaces').select('id,slug').eq('name','Staging Studio A')))[0];wid=w.id;
  const service=(await ok(owner.from('services').select('id').eq('workspace_id',wid).eq('name','Corte Staging')))[0].id;
  const user=(await ok(owner.auth.getUser())).user.id;
  const member=(await ok(owner.from('workspace_members').select('id').eq('workspace_id',wid).eq('user_id',user)))[0].id;
  const client=(await ok(owner.from('workspace_clients').select('id').eq('workspace_id',wid).eq('email','client@agende-staging.invalid')))[0].id;
  await check('inventory entry, exit and adjustment persist and negative stock is refused',async()=>{
    product=(await ok(owner.rpc('create_inventory_product',{p_workspace_id:wid,p_name:'Synthetic inventory '+Date.now(),p_initial_quantity:10,p_minimum_quantity:2,p_cost_cents:1200}))).id;
    await ok(owner.rpc('apply_inventory_movement',{p_workspace_id:wid,p_product_id:product,p_type:'entry',p_quantity:5}));
    await ok(owner.rpc('apply_inventory_movement',{p_workspace_id:wid,p_product_id:product,p_type:'exit',p_quantity:3}));
    await ok(owner.rpc('apply_inventory_movement',{p_workspace_id:wid,p_product_id:product,p_type:'adjustment',p_new_quantity:2,p_reason:'Synthetic count'}));
    assert.ok((await owner.rpc('apply_inventory_movement',{p_workspace_id:wid,p_product_id:product,p_type:'exit',p_quantity:3})).error);
    const ui=await ok(owner.rpc('get_inventory_ui',{p_workspace_id:wid}));assert.equal(ui.products.find(x=>x.id===product).quantity,2);
  });
  await check('another establishment cannot mutate inventory or read package administration',async()=>{
    assert.ok((await foreign.rpc('apply_inventory_movement',{p_workspace_id:wid,p_product_id:product,p_type:'entry',p_quantity:1})).error);
    assert.ok((await foreign.rpc('get_packages_ui',{p_workspace_id:wid})).error);
  });
  await check('package catalog and sale produce actual remaining sessions for the linked client',async()=>{
    pack=await ok(owner.rpc('create_service_package',{p_workspace_id:wid,p_name:'Synthetic package '+Date.now(),p_description:'Staging only',p_price_cents:10000,p_validity_days:30,p_items:[{service_id:service,quantity:2}]}));
    sale=await ok(owner.rpc('sell_service_package',{p_workspace_id:wid,p_client_id:client,p_package_id:pack}));
    const ui=await ok(owner.rpc('get_packages_ui',{p_workspace_id:wid}));const item=ui.sales.find(x=>x.id===sale);assert.equal(item.included_total,2);assert.equal(item.used_total,0);
    const mine=await ok(customer.rpc('list_my_packages'));assert.ok(JSON.stringify(mine).includes(sale));
  });
  const day=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  await check('public booking and package redemption link the same client and service exactly once',async()=>{
    const slots=await ok(guest.rpc('list_public_available_slots',{p_slug:w.slug,p_service_id:service,p_professional_member_id:member,p_local_date:day}));assert.ok(slots.length);
    await ok(guest.rpc('create_public_appointment',{p_slug:w.slug,p_service_id:service,p_professional_member_id:member,p_starts_at:slots.at(-1).starts_at,p_full_name:'Cliente Sintetico',p_phone:'+5532999999999',p_email:'client@agende-staging.invalid',p_customer_note:null,p_ip_hash:'synthetic-package-only'}));
    appointment=(await ok(customer.rpc('list_my_appointments'))).find(x=>x.status==='scheduled'&&new Date(x.starts_at).getTime()===new Date(slots.at(-1).starts_at).getTime()).id;
    const args={p_workspace_id:wid,p_client_package_id:sale,p_appointment_id:appointment};
    assert.equal((await owner.rpc('redeem_client_package',args)).error?.message,'appointment_must_be_completed_for_redemption');
    for(const status of ['confirmed','in_progress','completed'])await ok(owner.rpc('set_appointment_status',{p_appointment_id:appointment,p_status:status}));
    completed=true;
    redemption=(await ok(owner.rpc('redeem_client_package',args))).redemption_id;
    assert.ok((await owner.rpc('redeem_client_package',args)).error);
    const ui=await ok(owner.rpc('get_packages_ui',{p_workspace_id:wid}));assert.equal(ui.sales.find(x=>x.id===sale).used_total,1);
  });
  await check('redemption reversal restores balance and cancellation persists through the real API',async()=>{
    await ok(owner.rpc('reverse_package_redemption',{p_workspace_id:wid,p_redemption_id:redemption,p_reason:'Synthetic rollback'}));redemption=null;
    const ui=await ok(owner.rpc('get_packages_ui',{p_workspace_id:wid}));assert.equal(ui.sales.find(x=>x.id===sale).used_total,0);
    assert.ok((await customer.rpc('cancel_my_appointment',{p_appointment_id:appointment})).error);appointment=null;
    await ok(owner.rpc('cancel_client_package',{p_workspace_id:wid,p_client_package_id:sale}));sale=null;
  });
}catch(error){failure=error;}finally{
  const cleanupRpc=async(name,args)=>{try{await ok(owner.rpc(name,args));}catch{cleanup=false;}};
  if(redemption)await cleanupRpc('reverse_package_redemption',{p_workspace_id:wid,p_redemption_id:redemption,p_reason:'Synthetic cleanup'});
  if(appointment&&!completed)await cleanupRpc('cancel_my_appointment',{p_appointment_id:appointment});
  if(sale)await cleanupRpc('cancel_client_package',{p_workspace_id:wid,p_client_package_id:sale});
  if(pack)await cleanupRpc('archive_service_package',{p_workspace_id:wid,p_package_id:pack});
  if(product)await cleanupRpc('archive_inventory_product',{p_workspace_id:wid,p_product_id:product});
  for(const c of [owner,foreign,customer])await c.auth.signOut();
  writeFileSync('docs/staging/modules-real-api.json',JSON.stringify({checked_at:new Date().toISOString(),project:'fkpdudnnperufnmdwdlv',checks,passed:!failure&&cleanup,synthetic_catalog_archived_and_sale_cancelled:cleanup,completed_synthetic_appointment_retained:completed,production_connections:0,external_payments:0,error:failure?.message,secrets_in_report:false},null,2)+'\n');
}
if(failure)throw failure;assert.equal(cleanup,true,'Synthetic cleanup failed');
