// Offline plan only. Input is the read-only infrastructure snapshot, never DB credentials.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const snapshot=JSON.parse(readFileSync('docs/staging/profiles-infrastructure-20261015.json','utf8'));
const remote=snapshot.projects.find(p=>p.project==='wohimauqgywshbbejjcl');
if(!remote?.migrations)throw Error('Verified production inventory required');
const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
const missing=files.filter(file=>!remote.migrations.some(m=>m.version===file.slice(0,14)||m.name===file.slice(15,-4))).map((file,index)=>({order:index+1,path:'supabase/migrations/'+file,sha256_lf:createHash('sha256').update(readFileSync('supabase/migrations/'+file,'utf8').replaceAll('\r\n','\n')).digest('hex')}));
const remoteOnly=remote.migrations.filter(m=>!files.some(file=>file.slice(0,14)===m.version||file.slice(15,-4)===m.name));
const plan={checked_at:snapshot.checked_at,project:remote.project,production_writes:0,approved:false,remote_count:remote.migrations.length,local_files:files.length,missing,remote_only:remoteOnly,note:'Offline comparison by version/name. Inspect definitions and recorded historical drift before individually authorized rollout; never db push or migration repair by inference.'};
writeFileSync('docs/production-readiness/profiles-migration-plan-20261015.json',JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify({production_writes:0,missing:missing.length,remote_only:remoteOnly.length}));
