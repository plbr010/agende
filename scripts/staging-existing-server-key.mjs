import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
export function existingStagingServerKey() {
 assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
 const command='npx --yes supabase projects api-keys --project-ref fkpdudnnperufnmdwdlv --output json';
 const response=spawnSync(process.env.ComSpec??'cmd.exe',['/d','/s','/c',command],{encoding:'utf8',windowsHide:true});
 if(response.status!==0)throw new Error('Existing staging CLI credential unavailable; secrets unchanged');
 const key=JSON.parse(response.stdout).find(x=>x.name==='service_role')?.api_key;
 assert.ok(key,'Existing staging service credential required');return key;
}
