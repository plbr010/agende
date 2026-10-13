import test from 'node:test';
import assert from 'node:assert/strict';
import {cohortCash,economics,minimumForNet,effectiveTax,infrastructure} from './commercial-model.mjs';
const solo={mix:{solo:1,equipe:0,salao:0}};
test('annual Solo cash is 799 once, while revenue recognition is 799/12',()=>{
  const cash=cohortCash(1,{...solo,annual_share:1});assert.equal(cash[0].gross_cash_brl,799);assert.equal(cash[0].economic_mrr_brl,66.58);
  assert.ok(cash.slice(1).every(m=>m.gross_cash_brl===0));assert.equal(cash.at(-1).annual_revenue_not_yet_earned_brl,0);
});
test('monthly Solo uses the published 89.90 and twelve monthly cash charges',()=>{
  const cash=cohortCash(1,{...solo,annual_share:0});assert.ok(cash.every(m=>m.gross_cash_brl===89.90));assert.equal(economics(1,{...solo,annual_share:0}).arr_brl,1078.8);
});
test('illustrative fiscal bands change at RBT12 and do not assume eligibility',()=>{
  assert.equal(effectiveTax(180000,'illustrative_anexo_v'),.155);assert.equal(effectiveTax(180000,'illustrative_anexo_iii'),.06);
  assert.ok(effectiveTax(2000000,'illustrative_anexo_v')>.19);assert.throws(()=>effectiveTax(5000000,'illustrative_anexo_v'));
});
test('net target respects all operating expenses and returns the first viable integer',()=>{
  const goal=minimumForNet();assert.ok(goal.result.economic_monthly_net_brl>=5000);assert.ok(economics(goal.establishments-1).economic_monthly_net_brl<5000);
  assert.ok(goal.result.fixed_brl>=3360);assert.ok(goal.result.support_brl>0);assert.ok(goal.result.infrastructure.total_brl>0);
  assert.ok(infrastructure(1000,{stress:true}).total_brl>infrastructure(1000).total_brl);
});
