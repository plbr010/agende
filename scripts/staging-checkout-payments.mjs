// Hosted Checkout test cards only. Never accepts a live session or account.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
assert.equal(process.env.AGENDE_STAGING_ACCEPTANCE,'fkpdudnnperufnmdwdlv');
const source=JSON.parse(readFileSync('.test-postgres/staging-billing-links.json','utf8'));
assert.equal(source.project,'fkpdudnnperufnmdwdlv');assert.equal(source.livemode,false);
const checks=[],browser=await chromium.launch({channel:'msedge',headless:true});
try {
 for(const item of source.links){
  assert.match(item.session_id,/^cs_test_/);const url=new URL(item.checkout_url);assert.equal(url.hostname,'checkout.stripe.com');
  const context=await browser.newContext({locale:'pt-BR'}),page=await context.newPage();page.setDefaultTimeout(30000);
  await page.goto(url.href);await page.locator('#cardNumber').fill('4242424242424242');await page.locator('#cardExpiry').fill('1230');await page.locator('#cardCvc').fill('123');await page.locator('#billingName').fill('Homologação TEST');
  await page.getByRole('button',{name:'Assinar',exact:true}).click();
  await page.waitForURL(u=>u.hostname!=='checkout.stripe.com',{timeout:90000});
  checks.push({workspace_id:item.workspace_id,session_id:item.session_id,plan:item.plan,interval:item.interval,hosted_test_payment:'PASS'});console.log('PASS hosted TEST payment '+item.plan+' '+item.interval);await context.close();
 }
} catch {checks.push({hosted_test_payment:'FAIL',detail:'Private diagnostics withheld'});process.exitCode=1;} finally {
 writeFileSync('docs/staging/final-checkout-payments-20261015.json',JSON.stringify({checked_at:new Date().toISOString(),livemode:false,production_changed:false,checks},null,2)+'\n');await browser.close();
}
