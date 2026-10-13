import {writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const plans={solo:{monthly:89.90,annual:799},equipe:{monthly:169.90,annual:1499},salao:{monthly:299.90,annual:2799}};
export const defaults={fx_brl_per_usd:5.50,foreign_cost_reserve:.05,annual_share:.20,mix:{solo:.40,equipe:.40,salao:.20},card_percent:.0399,billing_percent:.007,card_fixed_brl:.50,tax_mode:'illustrative_anexo_v',risk_reserve:.03,support_per_salon_brl:10,advertising_brl:1000,owner_compensation_brl:2000,accounting_brl:300,domain_reserve_brl:10,backup_equipment_reserve_brl:50,appointments_per_month:400,staff_per_salon:4,auth_mau_per_salon:36,emails_per_salon:10,email_active_days:26,email_peak_factor:2,dynamic_requests_per_salon:5000,cdn_requests_per_salon:13000,queries_per_dynamic_request:3,bytes_per_query:2048,bytes_per_appointment_with_indexes_audit:8192,retention_months:12};
const round=x=>Math.round(x*100)/100;
function settings(input){const o={...defaults,...input};if(Math.abs(Object.values(o.mix).reduce((a,b)=>a+b,0)-1)>1e-9)throw new Error('mix_must_sum_to_one');if(o.annual_share<0||o.annual_share>1)throw new Error('invalid_annual_share');return o;}
export function effectiveTax(annualizedRevenue,mode){
  // Hypothetical steady RBT12. Eligibility/CNAE/fator R are NOT established.
  if(mode==='illustrative_flat_12pct')return .12;
  const bounds=[180000,360000,720000,1800000,3600000,4800000];
  const table=mode==='illustrative_anexo_iii'?[[.06,0],[.112,9360],[.135,17640],[.16,35640],[.21,125640],[.33,648000]]:mode==='illustrative_anexo_v'?[[.155,0],[.18,4500],[.195,9900],[.205,17100],[.23,62100],[.305,540000]]:null;
  if(!table)throw new Error('unknown_tax_scenario');const i=bounds.findIndex(b=>annualizedRevenue<=b);if(i<0)throw new Error('outside_illustrative_simples_limit');
  const [rate,deduction]=table[i];return annualizedRevenue===0?rate:(annualizedRevenue*rate-deduction)/annualizedRevenue;
}
export function demand(n,input={}){
  const o=settings(input),factor=input.stress?2:1;
  return{paying_establishments:n,staff:n*o.staff_per_salon,auth_mau:n*o.auth_mau_per_salon,appointments_per_month:n*o.appointments_per_month,api_queries_per_month:n*o.dynamic_requests_per_salon*o.queries_per_dynamic_request*factor,dynamic_requests_per_month:n*o.dynamic_requests_per_salon*factor,cdn_requests_per_month:n*o.cdn_requests_per_salon*factor,auth_emails_per_month:n*o.emails_per_salon,booking_emails_if_two_per_booking:n*o.appointments_per_month*2,storage_gb:n*.005,database_gb_at_retention:.0178+n*.001+n*o.appointments_per_month*o.bytes_per_appointment_with_indexes_audit*o.retention_months/1e9,egress_gb:n*o.dynamic_requests_per_salon*o.queries_per_dynamic_request*o.bytes_per_query*factor/1e9};
}
export function infrastructure(n,input={}){
  const o=settings(input),d=demand(n,input),compute=n>=1000?60:n>=300?15:10;
  const computeName=n>=1000?'Medium planning allowance':n>=300?'Small planning allowance':'Micro planning allowance';
  const cpuMs=input.stress?100:20,lifetimeMs=input.stress?600:150;
  const cpuHours=d.dynamic_requests_per_month*cpuMs/3600000,memoryGbHours=d.dynamic_requests_per_month*2*lifetimeMs/3600000;
  const functions=cpuHours*.128+memoryGbHours*.0106+d.dynamic_requests_per_month/1e6*.60;
  const cdn=d.cdn_requests_per_month<=1e6?0:d.cdn_requests_per_month<=10e6?20:d.cdn_requests_per_month<=50e6?100:300;
  const projectedEmailPeak=Math.ceil(d.auth_emails_per_month/o.email_active_days)*o.email_peak_factor;
  const email=d.auth_emails_per_month<=3000&&projectedEmailPeak<=100?0:20+Math.max(0,Math.ceil((d.auth_emails_per_month-50000)/1000))*.90;
  const disk=Math.max(0,d.database_gb_at_retention-8)*.125,egress=Math.max(0,d.egress_gb-250)*.09;
  // One Pro org, production+staging compute, one $10 compute credit.
  const supabase=25+compute+10-10+disk+egress;
  // 1 builder seat, opt-in Flat Rate CDN tier, $20 compute usage credit.
  const vercel=20+cdn+Math.max(0,functions+5-20);
  const usd=supabase+vercel+email;
  return{demand:d,production_compute_assumption:computeName,supabase_usd:round(supabase),vercel_usd:round(vercel),email_usd:round(email),total_usd:round(usd),total_brl:round(usd*o.fx_brl_per_usd*(1+o.foreign_cost_reserve)),foreign_cost_reserve_not_confirmed_tax:true,vercel_cpu_hours:round(cpuHours),vercel_memory_gb_hours:round(memoryGbHours),vercel_usage_usd_before_credit:round(functions+5),supabase_backup_policy:'Pro daily7d assumed; no PITR add-on',smtp_daily_free_limit:100,projected_peak_emails_per_day:projectedEmailPeak};
}
export function economics(n,input={}){
  const o=settings(input),monthly=Object.entries(o.mix).reduce((s,[p,w])=>s+plans[p].monthly*w,0),annual=Object.entries(o.mix).reduce((s,[p,w])=>s+plans[p].annual*w,0);
  const mrr=n*((1-o.annual_share)*monthly+o.annual_share*annual/12),transactions=n*((1-o.annual_share)+o.annual_share/12),tax=effectiveTax(mrr*12,o.tax_mode),infra=infrastructure(n,o);
  const fees=mrr*(o.card_percent+o.billing_percent)+transactions*o.card_fixed_brl;
  const fixed=o.advertising_brl+o.owner_compensation_brl+o.accounting_brl+o.domain_reserve_brl+o.backup_equipment_reserve_brl;
  const support=n*o.support_per_salon_brl,operating=infra.total_brl+fixed+support;
  return{establishments:n,mrr_brl:round(mrr),arr_brl:round(mrr*12),stripe_estimate_brl:round(fees),estimated_effective_tax_percent:round(tax*100),tax_estimate_brl:round(mrr*tax),risk_reserve_brl:round(mrr*o.risk_reserve),infrastructure:infra,fixed_brl:fixed,support_brl:support,operating_brl:round(operating),operating_usd_equivalent:round(operating/o.fx_brl_per_usd),economic_monthly_net_brl:round(mrr-fees-mrr*tax-mrr*o.risk_reserve-operating),not_confirmed_fiscal_classification:true};
}
export function cohortCash(n,input={}){
  const o=settings(input),e=economics(n,o),monthly=Object.entries(o.mix).reduce((s,[p,w])=>s+plans[p].monthly*w,0),annual=Object.entries(o.mix).reduce((s,[p,w])=>s+plans[p].annual*w,0),annualCash=n*o.annual_share*annual;
  let balance=0;
  return Array.from({length:12},(_,i)=>{
    const gross=n*(1-o.annual_share)*monthly+(i===0?annualCash:0),tx=n*(1-o.annual_share)+(i===0?n*o.annual_share:0),fees=gross*(o.card_percent+o.billing_percent)+tx*o.card_fixed_brl;
    const tax=gross*e.estimated_effective_tax_percent/100,net=gross-fees-tax-gross*o.risk_reserve-e.operating_brl;balance+=net;
    return{month:i+1,gross_cash_brl:round(gross),economic_mrr_brl:e.mrr_brl,fees_cash_brl:round(fees),tax_on_receipts_illustrative_brl:round(tax),cash_after_opex_and_risk_brl:round(net),cumulative_cash_brl:round(balance),annual_revenue_not_yet_earned_brl:round(annualCash*(11-i)/12),not_confirmed_tax_cash_regime:true};
  });
}
export function minimumForNet(target=5000,input={}){for(let n=1;n<2000;n++){if(economics(n,input).economic_monthly_net_brl>=target)return{establishments:n,result:economics(n,input)}}throw new Error('target_out_of_model_range');}
export function modelReport(){
  const compact=({establishments,result:r})=>({establishments,result:{mrr_brl:r.mrr_brl,operating_brl:r.operating_brl,stripe_estimate_brl:r.stripe_estimate_brl,tax_estimate_brl:r.tax_estimate_brl,risk_reserve_brl:r.risk_reserve_brl,economic_monthly_net_brl:r.economic_monthly_net_brl,not_confirmed_fiscal_classification:true}});
  return{
    generated_at:new Date().toISOString(),assumptions:defaults,
    exchange_rate_is_planning_assumption:true,prices_checked_on:'2026-10-13',
    sources:['https://supabase.com/pricing','https://vercel.com/docs/plans/pro-plan','https://vercel.com/docs/pricing/flat-rate-cdn','https://vercel.com/docs/functions/usage-and-pricing','https://stripe.com/br/pricing','https://stripe.com/br/billing/pricing','https://resend.com/pricing.md','https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278'],
    scenarios:[100,300,1000].map(n=>({base:economics(n),stress:economics(n,{stress:true})})),
    minimum_for_5000:{
      mixed:compact(minimumForNet()),
      by_plan:Object.keys(plans).map(plan=>({plan,
        monthly:compact(minimumForNet(5000,{annual_share:0,mix:{solo:0,equipe:0,salao:0,[plan]:1}})),
        annual:compact(minimumForNet(5000,{annual_share:1,mix:{solo:0,equipe:0,salao:0,[plan]:1}})),
      })),
      tax_sensitivity:['illustrative_anexo_iii','illustrative_flat_12pct','illustrative_anexo_v'].map(tax_mode=>({tax_mode,...compact(minimumForNet(5000,{tax_mode}))})),
      fx_sensitivity:[5,5.5,6].map(fx_brl_per_usd=>({fx_brl_per_usd,...compact(minimumForNet(5000,{fx_brl_per_usd}))})),
    },
    cohort_example_100:cohortCash(100),
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){mkdirSync('docs/commercial-readiness',{recursive:true});const report=modelReport();writeFileSync('docs/commercial-readiness/cost-model.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({scenario_summary:report.scenarios.map(s=>({n:s.base.establishments,operating_usd:s.base.operating_usd_equivalent,operating_brl:s.base.operating_brl,mrr:s.base.mrr_brl,net:s.base.economic_monthly_net_brl})),minimum:report.minimum_for_5000.mixed.establishments,by_plan:report.minimum_for_5000.by_plan.map(x=>({plan:x.plan,monthly:x.monthly.establishments,annual:x.annual.establishments}))}));}
