// Isolated browser harness: actual server component + built CSS, synthetic test data only.
// It never authenticates against Supabase or contacts Stripe.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { renderSalonDirectory } from './admin-salons-render-harness.mjs';
const dir='artifacts/master-admin-salons';mkdirSync(dir,{recursive:true});
const rows=['trial','paid','past_due','unpaid','none','unverified'].map((status,index)=>({
 id:'11111111-1111-4111-8111-'+String(index+1).padStart(12,'0'),name:'Salão teste '+status,
 owner_name:'Proprietário '+status,owner_email:status+'@synthetic.invalid',plan:'solo',status,
 trial_started_at:'2026-11-03T12:00:00Z',trial_ends_at:'2026-11-10T12:00:00Z',
}));
const counts={total:6,trial:1,paid:1,delinquent:2,unverified:1};
const css=readdirSync('.next/static/chunks').filter(f=>f.endsWith('.css')).map(f=>readFileSync('.next/static/chunks/'+f,'utf8')).join('\n');
const server=createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 const params=Object.fromEntries(url.searchParams);
 let items=rows.filter(row=>(!params.status||row.status===params.status||(params.status==='delinquent'&&['past_due','unpaid'].includes(row.status)))&&(!params.q||(row.name+' '+row.owner_name).toLowerCase().includes(params.q.toLowerCase())));
 const data={items,total:items.length,counts,as_of:'2026-11-05T12:00:00Z'};
 const html=await renderSalonDirectory(data,params,params.q==='simulate-outage');
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'</style></head><body class="agende-app"><main class="mx-auto max-w-[88rem] px-4 py-6">'+html+'</main></body></html>');
 }catch{res.statusCode=500;res.end('Test harness failed');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const results=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await page.goto(base+'/admin');
 assert.equal(await page.locator('section[aria-label="Indicadores de salões"] article').count(),4);
 assert.equal(await page.locator('tbody tr').count(),6);
 await page.screenshot({path:dir+'/desktop.png',fullPage:true});results.push('desktop: four metrics and six fixture statuses');
 await page.getByRole('link',{name:'Sem assinatura',exact:true}).click();
 assert.equal(await page.locator('tbody tr').count(),1);assert.match(await page.locator('tbody').innerText(),/Sem assinatura/);
 results.push('no subscription filter');
 await page.getByRole('searchbox').count(); // The labeled input is type text; use its accessible name.
 await page.getByRole('textbox',{name:'Buscar salão ou proprietário'}).fill('not-found');
 await page.getByRole('button',{name:'Buscar',exact:true}).click();
 assert.equal(await page.locator('tbody tr').count(),0);assert.match(await page.locator('main').innerText(),/Nenhum salão encontrado/);
 await page.getByRole('link',{name:'Limpar busca',exact:true}).click();
 await page.getByRole('link',{name:'Inadimplentes',exact:true}).click();
 assert.equal(await page.locator('tbody tr').count(),2);
 assert.match(await page.locator('tbody').innerText(),/past_due/);assert.match(await page.locator('tbody').innerText(),/unpaid/);
 results.push('search, empty state and separate past_due/unpaid');
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/admin');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.screenshot({path:dir+'/mobile.png',fullPage:true});
 results.push('mobile: document does not overflow, table scrolls inside container');
 await page.goto(base+'/admin?q=simulate-outage');
 assert.equal(await page.getByRole('alert').count(),1);
 assert.equal(await page.locator('article').count(),0);results.push('outage: no fabricated metrics');
 writeFileSync(dir+'/browser-results.json',JSON.stringify({passed:results.length,failed:0,results,kind:'actual component; mocked query boundary; no real Auth/Stripe'},null,2));
 console.log(JSON.stringify({passed:results.length,failed:0,results}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
