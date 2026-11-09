import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderSalonDirectory } from './admin-salons-render-harness.mjs';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const data={items:[{id:'11111111-1111-4111-8111-111111111111',name:'Salão <script>fixture</script>',owner_name:'Proprietário teste',owner_email:'owner@synthetic.invalid',plan:'solo',status:'none'}],total:1,counts:{total:1,trial:0,paid:0,delinquent:0,unverified:0},as_of:'2026-11-05T12:00:00Z'};
test('actual directory renders four metrics, real returned row, escaped names and all filters',async()=>{
 const html=await renderSalonDirectory(data,{q:'Proprietário teste',status:'none',page:'9'});
 assert.equal((html.match(/<article/g)||[]).length,4);
 assert.match(html,/Sem assinatura/);assert.match(html,/Salão &lt;script&gt;/);assert(!html.includes('<script>fixture'));
 assert.match(html,/aria-current="page"/);assert.match(html,/Ver detalhes/);
 assert.match(html,/status=delinquent/);assert.match(html,/q=Propriet%C3%A1rio/);
 assert(!html.includes('page=9'));assert(!html.includes('MRR'));assert(!html.includes('Crescimento'));
});
test('data outage never renders fabricated zero counters or delinquency',async()=>{
 const html=await renderSalonDirectory(data,{},true);
 assert.match(html,/role="alert"/);assert(!html.includes('<article'));assert(!html.includes('<table'));assert(!html.includes('Inadimplentes'));
});
test('unknown status and no payment history remain explicit',async()=>{
 const html=await renderSalonDirectory({...data,items:[{...data.items[0],status:'unexpected'}],counts:{...data.counts,unverified:1}});
 assert.match(html,/Status não verificado/);assert.match(html,/não entram nas contagens/);assert.match(html,/próxima cobrança não confirmada/);
});

test('legacy links keep their filters and are authorized before redirect', async()=>{
 const nativeRequire=createRequire(import.meta.url);
 for(const route of ['assinaturas','estabelecimentos']) {
  let allowed=true;
  const compiledModule={exports:{}};
  const target='/admin/'+route+(route==='assinaturas'?'/historico':'/gestao');
  const deps={
   '@/components/admin/salon-directory':{SalonDirectory:()=>null},
   '@/lib/admin/guard':{requireReadyPlatformAdmin:async()=>{if(!allowed)throw Error('denied');}},
   'next/navigation':{redirect:url=>{throw Error('redirect:'+url);}},
   '@/lib/admin/params':{withParams:(path,params)=>path+'?'+new URLSearchParams(params)},
  };
  const compiled=ts.transpileModule(readFileSync('src/app/admin/'+route+'/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports',compiled)(name=>deps[name]??nativeRequire(name),compiledModule,compiledModule.exports);
  const Page=compiledModule.exports.default;
  for(const params of [{plan:'solo',q:'Salão'},{status:'active'}]) await assert.rejects(Page({searchParams:Promise.resolve(params)}),e=>e.message.startsWith('redirect:'+target+'?'));
  if(route==='assinaturas')await assert.rejects(Page({searchParams:Promise.resolve({cobrancas:'1'})}),/historico/);
  const element=await Page({searchParams:Promise.resolve({status:'none'})});assert.equal(element.props.params.status,'none');
  allowed=false;await assert.rejects(Page({searchParams:Promise.resolve({plan:'solo'})}),/denied/);
 }
});
