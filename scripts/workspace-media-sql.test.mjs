import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createLocalDatabase} from './local-database.mjs';

test('workspace image lifecycle SQL: isolation, compare-and-swap, leases and idempotent DDL',async t=>{
  const db=await createLocalDatabase();t.after(()=>db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql','utf8'));
  const owner=(await db.query("select test_helpers.create_auth_user('media-owner@sql.invalid','professional',true) id")).rows[0].id;
  const other=(await db.query("select test_helpers.create_auth_user('media-other@sql.invalid','client',true) id")).rows[0].id;
  const as=(uid,sql,args=[])=>db.transaction(async tx=>{
    await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[uid]);
    await tx.exec('set local role authenticated');return tx.query(sql,args);
  });
  const wid=(await as(owner,"select public.create_workspace('Media SQL',null,'solo') result")).rows[0].result.workspace_id;
  const path=kind=>`${wid}/${kind}/${randomUUID()}.webp`;
  const first=path('logo'),second=path('logo');let cover=path('cover');
  await t.test('owner queues; another user cannot mutate or prepare another tenant',async()=>{
    await assert.rejects(as(other,"select public.queue_workspace_image_upload($1,'logo',$2)",[wid,first]),/not_authorized/);
    await assert.rejects(as(other,"select public.swap_workspace_image($1,'logo',null,null)",[wid]),/not_authorized/);
    await assert.rejects(as(owner,"select public.queue_workspace_image_upload($1,'logo',$2)",[wid,`avatars/${owner}/${randomUUID()}.webp`]),/invalid_image_path/);
  });
  const queue=async(kind,p)=>as(owner,'select public.queue_workspace_image_upload($1,$2,$3)',[wid,kind,p]);
  const swap=async(kind,expected,next)=>(await as(owner,'select public.swap_workspace_image($1,$2,$3,$4) result',[wid,kind,expected,next])).rows[0].result;
  await t.test('missing bytes cannot be referenced and normalized server bytes can',async()=>{
    await queue('logo',first);
    await assert.rejects(swap('logo',null,first),/invalid_image_path/);
    await db.query("insert into storage.objects(bucket_id,name) values('workspace-logos',$1)",[first]);
    assert.equal(await swap('logo',null,first),true);
    assert.equal((await db.query('select logo_path from public.workspace_settings where workspace_id=$1',[wid])).rows[0].logo_path,first);
  });
  await t.test('replacement is atomic; stale writes lose and referenced bytes are not claimed',async()=>{
    await queue('logo',second);await db.query("insert into storage.objects(bucket_id,name) values('workspace-logos',$1)",[second]);
    assert.equal(await swap('logo',null,second),false);
    assert.equal(await swap('logo',first,second),true);
    const claim=await as(owner,'select public.claim_workspace_image_cleanup($1) path',[wid]);
    assert.deepEqual(claim.rows.map(r=>r.path),[first]);
    await assert.rejects(swap('logo',second,first),/invalid_image_path/);
    await as(owner,'select public.finish_workspace_image_cleanup($1,$2)',[wid,first]);
  });
  await t.test('cover independent of logo; removal clears reference and queues cleanup',async()=>{
    await queue('cover',cover);await db.query("insert into storage.objects(bucket_id,name) values('workspace-logos',$1)",[cover]);
    assert.equal(await swap('cover',null,cover),true);
    assert.equal((await db.query("select public.get_public_workspace_cover((select slug from public.workspaces where id=$1)) cover",[wid])).rows[0].cover,cover);
    assert.equal(await swap('logo',second,null),true);
    assert.equal((await db.query('select cover_path from public.workspace_settings where workspace_id=$1',[wid])).rows[0].cover_path,cover);
    assert.equal(await swap('cover',cover,null),true);
    assert.equal((await db.query('select cover_path from public.workspace_settings where workspace_id=$1',[wid])).rows[0].cover_path,null);
    const nextCover=path('cover');await queue('cover',nextCover);
    await db.query("insert into storage.objects(bucket_id,name) values('workspace-logos',$1)",[nextCover]);
    assert.equal(await swap('cover',null,nextCover),true);cover=nextCover;
  });
  await t.test('expired pending upload cannot become current while cleanup runs',async()=>{
    const expired=path('logo');await queue('logo',expired);
    await db.query("insert into storage.objects(bucket_id,name) values('workspace-logos',$1)",[expired]);
    await db.query("update app.workspace_image_cleanup set available_at=now()-interval '1 second' where path=$1",[expired]);
    await as(owner,'select public.claim_workspace_image_cleanup($1)',[wid]);
    await assert.rejects(swap('logo',null,expired),/invalid_image_path/);
  });
  await t.test('migration reapplies without removing references or queued work',async()=>{
    await db.exec(readFileSync('supabase/migrations/20261015054116_workspace_media_and_settings_contract.sql','utf8'));
    await db.exec(readFileSync('supabase/migrations/20261015054818_workspace_settings_validation.sql','utf8'));
    assert.equal((await db.query('select cover_path from public.workspace_settings where workspace_id=$1',[wid])).rows[0].cover_path,cover);
  });
  await t.test('optional commercial fields save; invalid UF, timezone and CEP reject atomically',async()=>{
    await as(owner,"select public.update_workspace_settings($1,'Media SQL','media-sql',null,null,null,null,null,null,null,null,null)",[wid]);
    for(const [field,value,code] of [['p_state','ZZ','invalid_state'],['p_timezone','Mars/Nowhere','invalid_timezone'],['p_postal_code','abc','invalid_postal_code']]) {
      await assert.rejects(as(owner,`select public.update_workspace_settings(p_workspace_id=>$1,p_name=>'Uncommitted',p_slug=>'media-sql',${field}=>$2)`,[wid,value]),new RegExp(code));
      assert.equal((await db.query('select name from public.workspaces where id=$1',[wid])).rows[0].name,'Media SQL');
    }
  });
  await t.test('inactive subscription still blocks commercial writes and uploads without mutating profile or billing',async()=>{
    await db.transaction(async tx=>{
      await tx.exec("set local app.bypass_protected_columns='on'");
      await tx.query("update public.subscriptions set status='expired' where workspace_id=$1",[wid]);
    });
    await assert.rejects(as(owner,"select public.update_workspace_settings($1,'Blocked','media-sql')",[wid]),/workspace_subscription_inactive/);
    await assert.rejects(queue('logo',path('logo')),/workspace_subscription_inactive/);
    assert.equal((await db.query('select name from public.workspaces where id=$1',[wid])).rows[0].name,'Media SQL');
    assert.equal((await as(owner,'select public.create_client_profile() id')).rows[0].id,owner);
  });
});
