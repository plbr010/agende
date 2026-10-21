// Readback only. Never removes or rewrites business data.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const project='fkpdudnnperufnmdwdlv';assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const read=p=>JSON.parse(readFileSync(p,'utf8')),c=read('.env.staging-homologation.json'),resources=read('.env.adv20-journey-resources.json');assert.equal(c.url,`https://${project}.supabase.co`);assert.ok(resources.cleanup_finished_at);
const credentials={owner:read('.env.profiles-media-final20-fixtures.json').professional,old:read('.env.profiles-media-fixtures.json').professional,customer:read('.env.adv20-ui-booking-fixture.json')},clients={},checks=[];
const ok=async p=>{const r=await p;assert.ok(!r.error,'staging_readback_failed');return r.data;};
try{
 for(const [name,f]of Object.entries(credentials)){const client=createClient(c.url,c.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});await ok(client.auth.signInWithPassword(f));clients[name]=client;}
 const existing=Number(process.env.AGENDE_EXISTING_CANCELLED_APPOINTMENTS??0);assert.ok(Number.isSafeInteger(existing)&&existing>=0);
 const rows=await ok(clients.customer.rpc('list_my_appointments'));assert.equal(resources.appointments.length,2);assert.equal(rows.length,2+existing);assert.ok(rows.every(x=>x.status==='cancelled'));assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);assert.ok(resources.appointments.every(id=>rows.some(x=>x.id===id)));checks.push({name:'two intended appointments cancelled, expected prior cancelled history preserved, no extra booking',status:'PASS',prior_cancelled_history:existing});
 for(const row of resources.services){const s=await ok(clients[row.client].from('services').select('active,archived_at').eq('id',row.id).single());assert.equal(s.active,false);assert.ok(s.archived_at);}
 for(const row of resources.hours)assert.equal((await ok(clients[row.client].from('professional_working_hours').select('id').eq('id',row.id))).length,0);
 checks.push({name:'only generated services archived and generated working-hour rows absent',status:'PASS'});
 for(const row of resources.settings){const s=await ok(clients[row.client].from('workspace_settings').select('*').eq('workspace_id',row.w.id).single());for(const key of ['city','state','timezone','business_phone','business_email','address','postal_code','description','instagram','logo_path','cover_path','discovery_enabled'])assert.deepEqual(s[key],row.s[key]);}
 const user=(await ok(clients.customer.auth.getUser())).user;assert.equal((await ok(clients.customer.from('profiles').select('avatar_path').eq('user_id',user.id).single())).avatar_path,null);checks.push({name:'both establishments original settings/publication restored and new optional customer avatar removed',status:'PASS'});
}catch(e){checks.push({name:'staging cleanup readback',status:'FAIL',code:e.name});process.exitCode=1;}
finally{for(const client of Object.values(clients))await client.auth.signOut({scope:'local'});writeFileSync('docs/homologation/adv20-cleanup-readback.json',JSON.stringify({checked_at:new Date().toISOString(),project,business_writes:0,production_writes:0,checks},null,2)+'\n');}
