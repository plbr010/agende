import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Offline only: no database, credentials, remote CLI or migration execution.
const names=[
 '20261023190000_commissions_permissions_settlement.sql',
 '20261023190100_commissions_checkout_and_permissions.sql',
 '20261023190200_commissions_rpcs_rls.sql',
 '20261023190300_report_permission_and_receipts.sql',
 '20261023190400_package_reversal_keeps_service_history.sql',
 '20261024042359_pr84_financial_integrity.sql',
 '20261025010715_pr84_final_integrity.sql',
];
const migrations=names.map(name=>{
 const source=readFileSync('supabase/migrations/'+name,'utf8').replaceAll('\r\n','\n');
 return {name,version:name.slice(0,14),sha256_lf:createHash('sha256').update(source).digest('hex')};
});
writeFileSync('docs/commissions/pr84-final-manifest.json',JSON.stringify({
 purpose:'Review artifact only; does not authorize or execute migrations',
 history_precondition:'All seven versions absent. If any is present, stop and review its exact SQL; never repair/replay by assumption.',
 source_confirmation:'Owner confirmed the five original commission migrations were never applied outside local tests.',
 transaction:'Each file atomic; default grants and RLS verified after every committed stage. Prefer one reviewed transaction for the complete pending set and migration history.',
 migrations,
},null,2)+'\n');
