// Real human-assisted SSR/PKCE acceptance: credentials/consent stay in the UI.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createInterface} from 'node:readline';
const project='fkpdudnnperufnmdwdlv',origin='http://localhost:3000';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
assert.equal(process.env.AGENDE_STAGING_SMTP_READY,'1');
assert.ok(process.env.AGENDE_AUTH_TEST_EMAIL,'Agreed fresh identity required');
const config=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));
assert.equal(config.url,`https://${project}.supabase.co`);
function bundles(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?bundles(`${dir}/${e.name}`):e.name.endsWith('.js')?[`${dir}/${e.name}`]:[]);}
const files=bundles('.next/server').concat(bundles('.next/static'));
assert.ok(files.some(p=>readFileSync(p,'utf8').includes(config.url)),'Build staging first; public env is compiled');
assert.ok(!files.some(p=>readFileSync(p,'utf8').includes('https://wohimauqgywshbbejjcl.supabase.co')),'Production build refused');
const settings=await fetch(config.url+'/auth/v1/settings',{headers:{apikey:config.publishable_key}});
assert.ok(settings.ok);assert.equal((await settings.json()).mailer_autoconfirm,false);
const socket=createServer();await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(3000,'127.0.0.1',resolve);});await new Promise(resolve=>socket.close(resolve));
const report={checked_at:new Date().toISOString(),project,origin,mode:'real SSR forms; owner credentials; connected browser',checks:[],observations:[],production_connections:0,secrets_in_report:false,status:'RUNNING',commercial_acceptance:false};
const receipt=()=>writeFileSync('docs/staging/auth-pkce-observations.json',JSON.stringify(report,null,2)+'\n');
const server=spawn(process.execPath,['--import',new URL('./staging-auth-observer.mjs',import.meta.url).href,'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,AGENDE_AUTH_OBSERVER:project,NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishable_key,NEXT_PUBLIC_SITE_URL:origin}});
// No Next logs: diagnostics can contain auth links. Never capture form bodies.
server.stderr.resume();server.stdout.on('data',chunk=>{if(chunk.toString().includes('Ready in'))console.log('READY localhost:3000; complete /cadastro in connected browser');});
server.on('message',message=>{if(message?.type!=='agende-auth-evidence')return;report.observations.push(message.observation);receipt();console.log('OBSERVATION '+JSON.stringify(message.observation));});
const lines=createInterface({input:process.stdin});
lines.on('line',line=>{if(line==='stop'){report.status='STOPPED';receipt();server.kill();lines.close();return;}if(!/^[a-z_]+ (PASS|FAIL|BLOQUEADO)$/.test(line)){console.log('Use scenario_id PASS|FAIL|BLOQUEADO or stop');return;}const [name,status]=line.split(' ');report.checks.push({name,status,mode:'operator-observed evidence'});receipt();});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{report.status='STOPPED';receipt();server.kill();process.exit();});
server.on('exit',code=>{lines.close();if(report.status==='RUNNING')report.status='BLOQUEADO';receipt();process.exitCode=report.status==='STOPPED'?0:code??1;});receipt();
