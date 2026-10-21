// Continue session verification of the same newly created QA fixture, no new signup.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const project='wohimauqgywshbbejjcl',origin='https://agendeapp.online';
assert.equal(process.env.AGENDE_PRODUCTION_AUTH_ACCEPTANCE,project);
const file=process.env.AGENDE_PRODUCTION_AUTH_FIXTURE;assert.match(file,/^\.env\.production-auth-[a-z0-9-]+\.json$/);
const fixture=JSON.parse(readFileSync(file,'utf8'));assert.match(fixture.email,/\+agende-prod-auth-\d+@gmail[.]com$/);assert.ok(fixture.id);
let browser,phase='login';const checks=[];
try{
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(30000);
 await page.goto(origin+'/login');await page.locator('input[name=email]').fill(fixture.email);await page.locator('input[name=password]').fill(fixture.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('**/cliente');await page.reload();assert.equal(new URL(page.url()).pathname,'/cliente');
 checks.push({name:'same recovered QA fixture logs in with new password and session survives reload',status:'PASS'});
 phase='logout';await page.goto(origin+'/cliente/perfil');await page.getByRole('button',{name:'Sair da conta',exact:true}).click();await page.waitForURL(origin+'/');await page.goto(origin+'/cliente');await page.waitForURL('**/login?next=**');
 checks.push({name:'actual profile logout clears session and client area requires login',status:'PASS'});
}catch(error){checks.push({name:phase,status:'FAIL',code:error.name});process.exitCode=1;}
finally{await browser?.close();writeFileSync('docs/production-readiness/auth21-production-session.json',JSON.stringify({checked_at:new Date().toISOString(),project,scope:'same new own fixture after successful SMTP/PKCE/recovery',users_created:0,users_deleted:0,passwords_changed:0,bookings_created:0,financial_operations:0,checks},null,2)+'\n');}
