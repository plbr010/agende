import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {createClient} from '@supabase/supabase-js';
const project='fkpdudnnperufnmdwdlv';assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,project);
const c=JSON.parse(readFileSync('.env.staging-homologation.json','utf8'));assert.equal(c.url,`https://${project}.supabase.co`);
const api=createClient(c.url,c.publishable_key,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=async p=>{const r=await p;assert.equal(r.error,null,r.error?.code);return r.data;};
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const origin=`http://127.0.0.1:${port}`,name='P0 browser product '+randomUUID(),checks=[];
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{windowsHide:true,stdio:'ignore',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:c.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:c.publishable_key,SITE_URL:origin}});
let browser,product,workspace,passed=false,cleaned=true;
try {
 for(let n=0;n<80;n++){try{if((await fetch(origin+'/login')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 await ok(api.auth.signInWithPassword({email:'owner-a@agende-staging.invalid',password:c.fixture_password}));
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();page.setDefaultTimeout(30000);
 await page.goto(origin+'/login?next=%2Fapp%2Festoque');await page.getByLabel('E-mail',{exact:true}).fill('owner-a@agende-staging.invalid');await page.locator('input[name=password]').fill(c.fixture_password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('**/app/estoque');
 await page.getByText('+ Novo produto',{exact:true}).click();
 const form=page.locator('form').filter({has:page.locator('input[name=action][value=product-create]')});
 await form.locator('input[name=name]').fill(name);await form.locator('input[name=description]').fill('D'.repeat(501));await form.getByRole('button',{name:'Criar produto',exact:true}).click();
 await form.getByRole('alert').filter({hasText:'A descrição pode ter até 500 caracteres.'}).waitFor();
 assert.equal((await ok(api.from('inventory_products').select('id').eq('name',name))).length,0);checks.push('501-character description rejected in actual Server Action with actionable error and zero committed rows');
 await form.locator('input[name=name]').fill(name);await form.locator('input[name=description]').fill('Descrição válida');await form.getByRole('button',{name:'Criar produto',exact:true}).click();
 await form.getByText('Alteração salva.',{exact:true}).waitFor();
 const row=await ok(api.from('inventory_products').select('id,workspace_id,description').eq('name',name).single());product=row.id;workspace=row.workspace_id;assert.equal(row.description,'Descrição válida');
 await page.reload();await page.getByRole('heading',{name,exact:true}).waitFor();checks.push('valid product persists through real form and reload');passed=true;
} finally {
 if(!product){try{const rows=await ok(api.from('inventory_products').select('id,workspace_id').eq('name',name));product=rows[0]?.id;workspace=rows[0]?.workspace_id;}catch{cleaned=false;}}
 if(product){try{await ok(api.rpc('archive_inventory_product',{p_workspace_id:workspace,p_product_id:product}));}catch{cleaned=false;}}
 await browser?.close();server.kill();await api.auth.signOut({scope:'local'});
 writeFileSync('docs/staging/p0-inventory-form-20261015.json',JSON.stringify({checked_at:new Date().toISOString(),project,passed,cleanup:cleaned,production_writes:0,checks},null,2)+'\n');
}
assert.ok(passed&&cleaned);
