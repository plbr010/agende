import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

// Execution evidence, not external acceptance. SQL identity still is a fixture.
const sqlFiles=['database.test.mjs','launch-readiness.test.mjs','final-hardening.test.mjs','atomic-service-sql.test.mjs'];
const sourceCache=new Map();
function category(file){
  if(file.endsWith('pg17-concurrency.test.mjs'))return 'native_pg17_concurrency';
  if(file.endsWith('action-sql-integration.test.mjs'))return process.env.AGENDE_NATIVE_PG_PORT?'native_pg17_integration_with_mock_auth':'pglite_integration_with_mock_auth';
  if(sqlFiles.some(name=>file.endsWith(name)))return process.env.AGENDE_NATIVE_PG_PORT?'native_pg17_sql':'pglite_sql';
  if(file.endsWith('stripe-edge.test.mjs'))return 'stripe_mocks';
  if(!sourceCache.has(file)){let source='';try{source=readFileSync(file,'utf8');}catch{source='';}sourceCache.set(file,source);}
  return /runInNewContext|mockAuth|mockClient|mockSession/.test(sourceCache.get(file))?'platform_mocks':'unit_or_static_contract';
}
export default async function* reporter(events){
  const results=[],groups={};
  for await(const event of events){
    if(!['test:pass','test:fail'].includes(event.type))continue;
    const data=event.data,file=resolve(data.file??''),kind=category(file),status=data.skip?'skipped':event.type==='test:pass'?'passed':'failed';
    const group=groups[kind]??={passed:0,failed:0,skipped:0};group[status]++;
    results.push({file:relative(process.cwd(),file).replaceAll('\\','/'),name:data.name,category:kind,status});
    yield `${status==='passed'?'PASS':status==='skipped'?'SKIP':'FAIL'} [${kind}] ${data.name}\n`;
    if(status==='failed')yield String(data.details?.error?.message??'Test failed')+'\n';
  }
  const totals={passed:0,failed:0,skipped:0};for(const group of Object.values(groups))for(const key of Object.keys(totals))totals[key]+=group[key];
  const path='docs/homologation/'+(process.env.AGENDE_NATIVE_PG_PORT?'native-tests.json':'standard-tests.json');mkdirSync('docs/homologation',{recursive:true});
  writeFileSync(path,JSON.stringify({checked_at:new Date().toISOString(),groups,totals,external_authenticated_services_tested:false,cases:results},null,2)+'\n');
  yield JSON.stringify({totals,groups})+'\n';
}
