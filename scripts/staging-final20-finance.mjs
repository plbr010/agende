// Only own synthetic ledger entries in explicit staging. No payment provider calls.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const project='fkpdudnnperufnmdwdlv';assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const cfg=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));assert.equal(cfg.url,`https://${project}.supabase.co`);
const fixture=JSON.parse(readFileSync('.env.profiles-media-final20-fixtures.json','utf8')).professional;
const staff=JSON.parse(readFileSync('.env.final20-employee-fixture.json','utf8'));
const make=()=>createClient(cfg.url,cfg.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=make(),foreign=make(),employee=make(),checks=[];
const ok=async p=>{const r=await p;assert.ok(!r.error,'finance_staging_operation_failed');return r.data;};
let entry,expense,refunded=0;
try{
 for(const [client,f]of [[owner,fixture],[employee,staff],[foreign,{email:'owner-b@agende-staging.invalid',password:cfg.fixture_password}]])await ok(client.auth.signInWithPassword({email:f.email,password:f.password}));
 const wid=fixture.workspaceId,due=new Date().toISOString().slice(0,10),args={p_workspace_id:wid,p_description:'Owned synthetic income P0',p_entry_type:'income',p_amount_cents:10000,p_due_date:due,p_idempotency_key:randomUUID()};
 entry=await ok(owner.rpc('create_financial_entry',args));assert.equal(await ok(owner.rpc('create_financial_entry',args)),entry);
 await ok(owner.rpc('mark_financial_entry_paid',{p_workspace_id:wid,p_entry_id:entry,p_payment_method:'pix'}));
 const refund={p_workspace_id:wid,p_entry_id:entry,p_amount_cents:1000,p_reason:'Owned synthetic finance acceptance',p_payment_method:'pix',p_idempotency_key:randomUUID()};
 const first=await ok(owner.rpc('refund_financial_entry',refund));refunded=1000;assert.deepEqual(await ok(owner.rpc('refund_financial_entry',refund)),first);
 const period={p_workspace_id:wid,p_start_date:due,p_end_date:due};const ui=await ok(owner.rpc('get_finance_ui',period));const row=ui.entries.find(x=>x.id===entry);assert.equal(row.status,'paid');assert.equal(row.amount_cents,10000);assert.equal(row.refunded_cents,1000);
 checks.push({name:'income creation is idempotent; local payment and idempotent partial refund match real finance UI read model',status:'PASS'});
 for(const actor of [foreign,employee]){assert.ok((await actor.rpc('get_finance_ui',period)).error);assert.ok((await actor.rpc('mark_financial_entry_paid',{p_workspace_id:wid,p_entry_id:entry,p_payment_method:'pix'})).error);}
 assert.ok((await owner.rpc('create_financial_entry',{...args,p_amount_cents:0,p_idempotency_key:randomUUID()})).error);
 checks.push({name:'foreign tenant and professional cannot read or mutate finance; zero amount rejected',status:'PASS'});
 await ok(owner.rpc('refund_financial_entry',{...refund,p_amount_cents:9000,p_idempotency_key:randomUUID()}));refunded=10000;
 expense=await ok(owner.rpc('create_financial_entry',{...args,p_entry_type:'expense',p_description:'Owned synthetic expense P0',p_amount_cents:1000,p_idempotency_key:randomUUID()}));
 await ok(owner.rpc('cancel_financial_entry',{p_workspace_id:wid,p_entry_id:expense}));await ok(owner.rpc('reopen_financial_entry',{p_workspace_id:wid,p_entry_id:expense}));await ok(owner.rpc('cancel_financial_entry',{p_workspace_id:wid,p_entry_id:expense}));
 assert.equal((await ok(owner.from('financial_entries').select('status').eq('id',expense).single())).status,'cancelled');
 checks.push({name:'own expense cancel and reopen persist; synthetic income fully refunded with history retained',status:'PASS'});
}catch(error){writeFileSync('.env.final20-finance-error.txt',String(error.stack));checks.push({name:'finance acceptance',status:'FAIL',code:error.name});process.exitCode=1;}
finally{
 if(entry&&refunded<10000){try{await ok(owner.rpc('refund_financial_entry',{p_workspace_id:fixture.workspaceId,p_entry_id:entry,p_amount_cents:10000-refunded,p_reason:'Owned synthetic cleanup',p_payment_method:'pix',p_idempotency_key:randomUUID()}));}catch{checks.push({name:'refund own remaining synthetic amount',status:'FAIL'});process.exitCode=1;}}
 for(const c of [owner,foreign,employee])await c.auth.signOut({scope:'local'});
 writeFileSync('docs/homologation/final20-finance.json',JSON.stringify({checked_at:new Date().toISOString(),project,external_payments:0,production_writes:0,existing_data_deleted:false,checks},null,2)+'\n');console.log(JSON.stringify({checks}));
}
