import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createLocalDatabase} from './local-database.mjs';

test('public discovery: consent, any city, global name, pagination, privacy and tenant permissions',async t=>{
  const db=await createLocalDatabase();t.after(()=>db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql','utf8'));
  const as=(uid,sql,args=[])=>db.transaction(async tx=>{
    if(uid)await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);
    await tx.exec(uid?'set local role authenticated':'set local role anon');
    return (await tx.query(sql,args)).rows[0]?.data;
  });
  const create=async(name,city,state)=>{
    const uid=(await db.query("select test_helpers.create_auth_user($1,'professional',true) id",[name.replaceAll(' ','')+'@discovery.invalid'])).rows[0].id;
    const wid=(await as(uid,"select public.create_workspace($1,null,'equipe') data",[name])).workspace_id;
    await db.query('update public.workspace_settings set city=$2,state=$3,business_email=$4,address=$5 where workspace_id=$1',[wid,city,state,'private@discovery.invalid','Private street']);
    return {uid,wid};
  };
  const a=await create('Ateliê Alpha','São Paulo','SP'),b=await create('Ateliê Beta','Salvador','BA'),c=await create('Ateliê Gamma','São Paulo','SP');
  const search=(city=null,query=null,offset=0,limit=20)=>as(null,'select public.search_public_workspaces($1,null,$2,null,$3,$4) data',[city,query,limit,offset]);
  assert.equal((await search('São Paulo')).total,0);
  await assert.rejects(as(null,'select public.set_workspace_discovery($1,true) data',[a.wid]),/permission denied/);
  await assert.rejects(as(b.uid,'select public.set_workspace_discovery($1,true) data',[a.wid]),/not_authorized/);
  for(const x of [a,b,c])await as(x.uid,'select public.set_workspace_discovery($1,true) data',[x.wid]);
  const page1=await search('sao paulo',null,0,1),page2=await search('sao paulo',null,1,1);
  assert.equal(page1.total,2);assert.equal(page1.items.length,1);assert.notEqual(page1.items[0].slug,page2.items[0].slug);
  assert.deepEqual(Object.keys(page1.items[0]).sort(),['booking_open','city','description','logo_path','name','slug','state'].sort());
  assert.equal((await search('Salvador')).items[0].name,'Ateliê Beta');
  assert.equal((await search(null,'atelie')).total,3);
  assert.equal((await search(null,'%_')).total,0); // literal, never wildcard enumeration
  const localities=await as(null,"select public.list_public_localities(null,'sao',8) data");
  assert.equal(localities.localities[0].workspace_count,2);
  assert.equal((await search('São Paulo')).items[0].booking_open,false);
  const member=(await db.query('select id from public.workspace_members where workspace_id=$1',[a.wid])).rows[0].id;
  await as(a.uid,"select public.save_service_with_professionals($1,null,'Corte',null,30,5000,true,$2) data",[a.wid,[member]]);
  assert.equal((await search(null,'Alpha')).items[0].booking_open,true);
  await db.transaction(async tx=>{
    await tx.exec("select set_config('app.bypass_protected_columns','on',true)");
    await tx.query("update public.subscriptions set status='expired' where workspace_id=$1",[a.wid]);
  });
  assert.equal((await search(null,'Alpha')).total,0);
  // Withdrawal remains possible after entitlement expires.
  await as(a.uid,'select public.set_workspace_discovery($1,false) data',[a.wid]);
  await as(c.uid,'select public.set_workspace_discovery($1,false) data',[c.wid]);
  assert.equal((await search('São Paulo')).total,0);
  const professional=(await db.query("select test_helpers.create_auth_user('staff@discovery.invalid','professional',true) id")).rows[0].id;
  await db.query("insert into public.workspace_members(workspace_id,user_id,role,status) values($1,$2,'professional','active')",[b.wid,professional]);
  await assert.rejects(as(professional,'select public.set_workspace_discovery($1,true) data',[b.wid]),/not_authorized/);
  await assert.rejects(search(null,null),/invalid_discovery_input/);
  await assert.rejects(search(null,'Beta',10001),/invalid_discovery_input/);
  await assert.rejects(search(null,'Beta',0,51),/invalid_discovery_input/);
  await assert.rejects(as(null,"select public.search_public_workspaces(null,'XX','Beta') data"),/invalid_discovery_input/);
  await assert.rejects(as(null,"select public.search_public_workspaces(null,null,'Beta','12345678') data"),/invalid_discovery_input/);
  await assert.rejects(as(null,"select app.discovery_text('private') data"),/permission denied/);
});
