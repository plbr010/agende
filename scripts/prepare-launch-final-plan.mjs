import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

// Offline inventory only: this file never opens a database connection or repairs history.
const catalog = JSON.parse(readFileSync('docs/production-readiness/launch-final-catalog-readonly.json', 'utf8'));
const files = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
const historical = readFileSync('supabase/migrations/20261009172028_launch_observed_owner_guard.sql', 'utf8').replaceAll('\r', '');
const observed = [...historical.matchAll(/v_expected text := \$observed\$([\s\S]*?)\$observed\$;/g)].map(m => m[1]);
const expectedTrigger = 'CREATE CONSTRAINT TRIGGER workspace_members_keep_owner AFTER INSERT OR UPDATE OF role, status ON public.workspace_members DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION app.enforce_active_owner()';
const guards = catalog.membership_functions.map(f => ({
  signature: f.signature,
  matches_expected: observed.includes(f.definition.replaceAll('\r', '')),
}));
const pending = files.filter(f => !catalog.history.some(h => h.version === f.slice(0, 14))).map(file => ({
  file, version: file.slice(0, 14),
  sha256_lf: createHash('sha256').update(readFileSync('supabase/migrations/' + file, 'utf8').replaceAll('\r\n', '\n')).digest('hex'),
  historical_reconciliation: file.startsWith('20261009172028'),
}));
const plan = {
  purpose: 'Read-only review manifest; no execution or migration repair is authorized',
  base_sha: 'd39b2802f393eafbdc628d2a24f8368a685569b0',
  published_sha: 'a3923c4223e234365deb0d56c932ca53106920ef',
  catalog_observed_at_utc: catalog.observed_at_utc,
  catalog_observed_on: catalog.observed_on,
  historical_guards: guards,
  historical_trigger_matches_expected: catalog.membership_trigger === expectedTrigger,
  pending,
  remote_only: catalog.history.filter(h => !files.some(f => f.startsWith(h.version + '_'))),
  decision: 'Historical effects already observed, version absent from ledger; owner must approve any explicit reconciliation. Never reconstruct the remote-only migration or run repair automatically.',
};
if (guards.length !== 5 || guards.some(g => !g.matches_expected) || !plan.historical_trigger_matches_expected) throw Error('Historical catalog drift requires review');
writeFileSync('docs/production-readiness/launch-final-migration-plan.json', JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify({pending: pending.length, historical: pending.filter(m => m.historical_reconciliation).length, remote_only: plan.remote_only, guards_match: true}));
