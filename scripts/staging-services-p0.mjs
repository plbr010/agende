// Actual Auth + PostgREST, synthetic services only. No production configuration.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const project='fkpdudnnperufnmdwdlv';assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const c=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));assert.equal(c.url,`https://${project}.supabase.co`);
const make=()=>createClient(c.url,c.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=make(),admin=make(),professional=make(),foreign=make(),guest=make(),reload=make();
const services=[],checks=[],prefix='Service P0 '+randomUUID();let w,ownMember,adminMember,proMember,foreignMember,one,multi,hours,passed=false,cleaned=true;
const ok=async p=>{const r=await p;assert.equal(r.error,null,r.error?.code);return r.data;};
const check=async(name,fn)=>{try{await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){checks.push({name,status:'FAIL',code:e.code??'assertion'});throw e;}};
const args=(name,members,id=null,active=true)=>({p_workspace_id:w.id,p_service_id:id,p_name:name,p_description:'Descrição real de homologação',p_duration_minutes:45,p_price_cents:12345,p_active:active,p_professional_member_ids:members});
const links=id=>ok(owner.from('professional_services').select('professional_member_id,active').eq('workspace_id',w.id).eq('service_id',id).order('professional_member_id'));
try {
 for(const [client,email] of [[owner,'owner-a'],[admin,'admin'],[professional,'professional'],[foreign,'owner-b'],[reload,'owner-a']])await ok(client.auth.signInWithPassword({email:email+'@agende-staging.invalid',password:c.fixture_password}));
 w=await ok(owner.from('workspaces').select('id,slug').eq('name','Staging Studio A').single());
 const member=async(client,wid)=>{const uid=(await ok(client.auth.getUser())).user.id;return (await ok(client.from('workspace_members').select('id,role').eq('workspace_id',wid).eq('user_id',uid).single()));};
 ownMember=(await member(owner,w.id)).id;const a=await member(admin,w.id);adminMember=a.id;assert.equal(a.role,'admin');proMember=(await member(professional,w.id)).id;
 const fw=await ok(foreign.from('workspaces').select('id').eq('name','Staging Studio B').single());foreignMember=(await member(foreign,fw.id)).id;
 await check('owner creates service with one professional and all scalar fields persist',async()=>{
  one=await ok(owner.rpc('save_service_with_professionals',args(prefix+' single',[ownMember])));services.push(one);
  const row=await ok(reload.from('services').select('name,description,price_cents,duration_minutes,active').eq('id',one).single());
  assert.deepEqual(row,{name:prefix+' single',description:'Descrição real de homologação',price_cents:12345,duration_minutes:45,active:true});
  assert.deepEqual(await links(one),[{professional_member_id:ownMember,active:true}]);
 });
 await check('owner creates multi-professional service with exactly three active links',async()=>{
  multi=await ok(owner.rpc('save_service_with_professionals',args(prefix+' multiple',[ownMember,adminMember,proMember])));services.push(multi);
  const rows=await links(multi);assert.equal(rows.length,3);assert.ok(rows.every(x=>x.active));
 });
 await check('administrator edits fields and selected links atomically, preserved after independent reload',async()=>{
  await ok(admin.rpc('save_service_with_professionals',{...args(prefix+' edited',[ownMember,proMember],multi),p_description:'Editado pela administradora',p_duration_minutes:60,p_price_cents:23456}));
  const row=await ok(reload.from('services').select('name,description,duration_minutes,price_cents').eq('id',multi).single());assert.deepEqual(row,{name:prefix+' edited',description:'Editado pela administradora',duration_minutes:60,price_cents:23456});
  assert.deepEqual((await links(multi)).filter(x=>x.active).map(x=>x.professional_member_id).sort(),[ownMember,proMember].sort());
 });
 await check('foreign establishment and professional cannot edit manager catalog',async()=>{
  assert.ok((await foreign.rpc('save_service_with_professionals',args('Must not persist',[ownMember],multi))).error);
  assert.ok((await professional.rpc('save_service_with_professionals',args('Must not persist',[ownMember],multi))).error);
  assert.equal((await ok(foreign.from('services').select('id').eq('id',multi))).length,0);
  assert.equal((await ok(owner.from('services').select('name').eq('id',multi).single())).name,prefix+' edited');
 });
 await check('invalid foreign professional rejects entire create and edit without partial changes',async()=>{
  const before=await links(multi);
  assert.ok((await owner.rpc('save_service_with_professionals',args(prefix+' rejected',[ownMember,foreignMember]))).error);
  assert.equal((await ok(owner.from('services').select('id').eq('name',prefix+' rejected'))).length,0);
  assert.ok((await owner.rpc('save_service_with_professionals',args('Must not persist',[ownMember,foreignMember],multi))).error);
  assert.deepEqual(await links(multi),before);
  assert.equal((await ok(owner.from('services').select('name').eq('id',multi).single())).name,prefix+' edited');
 });
 await check('eligible service appears in anonymous booking catalog and offers actual available slots',async()=>{
  const catalog=await ok(guest.rpc('list_public_booking_catalog',{p_slug:w.slug}));assert.ok(catalog.services.some(s=>s.id===one));
  assert.ok(catalog.professionals.some(p=>p.id===ownMember&&p.service_ids.includes(one)));
  const day=new Date(Date.now()+3*86400000).toISOString().slice(0,10),weekday=new Date(day+'T12:00:00Z').getUTCDay();
  if(!(await ok(owner.from('professional_working_hours').select('id').eq('professional_member_id',ownMember).eq('weekday',weekday))).length)hours=(await ok(owner.from('professional_working_hours').insert({workspace_id:w.id,professional_member_id:ownMember,weekday,start_time:'08:00',end_time:'18:00'}).select('id').single())).id;
  const slots=await ok(guest.rpc('list_public_available_slots',{p_slug:w.slug,p_service_id:one,p_professional_member_id:ownMember,p_local_date:day}));assert.ok(slots.length>0);
 });
 await check('deactivation persists and removes service from public booking and available slots',async()=>{
  await ok(owner.rpc('save_service_with_professionals',args(prefix+' single',[ownMember],one,false)));
  assert.equal((await ok(reload.from('services').select('active').eq('id',one).single())).active,false);
  assert.ok(!(await ok(guest.rpc('list_public_booking_catalog',{p_slug:w.slug}))).services.some(s=>s.id===one));
  const slots=await guest.rpc('list_public_available_slots',{p_slug:w.slug,p_service_id:one,p_professional_member_id:ownMember,p_local_date:new Date(Date.now()+3*86400000).toISOString().slice(0,10)});assert.ok(slots.error||slots.data.length===0);
 });
 passed=true;
} finally {
 for(const id of services){try{await ok(owner.from('services').update({active:false,archived_at:new Date().toISOString()}).eq('id',id).eq('workspace_id',w.id));}catch{cleaned=false;}}
 if(hours){try{await ok(owner.from('professional_working_hours').delete().eq('id',hours));}catch{cleaned=false;}}
 for(const client of [owner,admin,professional,foreign,reload])await client.auth.signOut({scope:'local'});
 writeFileSync('docs/staging/services-real-20261015.json',JSON.stringify({checked_at:new Date().toISOString(),project,passed,cleanup:cleaned,production_writes:0,mode:'real staging GoTrue/PostgREST; pre-existing confirmed synthetic identities, no SMTP or production acceptance',checks},null,2)+'\n');
}
assert.ok(passed&&cleaned);
