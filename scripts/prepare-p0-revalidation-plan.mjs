// Offline comparison of the newly observed production history; never executes DDL.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const state=JSON.parse(readFileSync('docs/staging/p0-current-state-20261015.json','utf8'));
const remote=state.projects.find(p=>p.project_id==='wohimauqgywshbbejjcl').migrations;
const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
const matches=(file,m)=>file.slice(0,14)===m.version||file.slice(15,-4)===m.name;
const pending=files.filter(f=>!remote.some(m=>matches(f,m))).map((file,index)=>({order:index+1,path:'supabase/migrations/'+file,sha256_lf:createHash('sha256').update(readFileSync('supabase/migrations/'+file,'utf8').replaceAll('\r\n','\n')).digest('hex')}));
const plan={checked_at:state.checked_at,production_writes:0,approved:false,remote_count:remote.length,local_files:files.length,pending,remote_only:remote.filter(m=>!files.some(f=>matches(f,m))),instruction:'Review semantic drift, obtain recoverable production backup and isolated restore, then obtain specific approval for each payload. Never db push or migration repair automatically.'};
writeFileSync('docs/production-readiness/P0-REVALIDATION-MIGRATIONS-20261015.json',JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({pending:pending.length,remote_only:plan.remote_only.length,production_writes:0}));
