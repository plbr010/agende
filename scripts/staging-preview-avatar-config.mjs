// Explicit Codex staging Preview only. Never prints credentials or CLI output.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existingStagingServerKey} from './staging-existing-server-key.mjs';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const branch=process.env.AGENDE_STAGING_PREVIEW_BRANCH;
assert.match(branch??'',/^codex\/[a-z0-9][a-z0-9/-]{1,100}$/,'Explicit safe staging Preview branch required');
const key=existingStagingServerKey();
const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));
assert.equal(claims.ref,'fkpdudnnperufnmdwdlv');
assert.equal(claims.role,'service_role');
const result=spawnSync(process.env.ComSpec??'cmd.exe',['/d','/s','/c',
  `npx --yes vercel env add SUPABASE_SERVICE_ROLE_KEY preview --git-branch ${branch} --project agende --scope pedros-projects-cfddfd39 --type secret --yes`],
  {input:key+'\n',encoding:'utf8',windowsHide:true});
console.log(JSON.stringify({project:'agende',branch,target:'preview',server_only:true,
  credential_project_verified:true,status:result.status===0?'PASS':'BLOCKED',
  reason:result.status===0?undefined:'Vercel CLI authentication/configuration unavailable; raw output suppressed'}));
process.exitCode=result.status===0?0:2;
