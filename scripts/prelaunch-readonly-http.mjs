// Public HTTPS GETs only. No credentials, Auth calls, RPC mutations or webhooks.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const origin = 'https://agendeapp.online';
const checks = [], assets = new Set();
for (const path of ['/', '/login', '/descobrir?cidade=Muria%C3%A9&uf=MG', '/descobrir?cidade=Juiz+de+Fora&uf=MG', '/api/account/avatar']) {
  const response = await fetch(origin + path, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
  assert.equal(new URL(response.url).origin, origin, 'unexpected_redirect_origin');
  const expected = path.startsWith('/api/') ? 401 : 200;
  checks.push({ path, http_status: response.status, status: response.status === expected ? 'PASS' : 'FAIL' });
  const html = await response.text();
  for (const match of html.matchAll(/src="([^"\s]+\.js(?:\?[^"\s]*)?)"/g)) {
    const url = new URL(match[1].replaceAll('&amp;', '&'), origin);
    if (url.origin === origin && url.pathname.startsWith('/_next/static/')) assets.add(url.href);
  }
}
let privilegedTokens = 0, privateKeyLiterals = 0;
for (const url of assets) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, 'public_asset_fetch_failed');
  const source = await response.text();
  privateKeyLiterals += [...source.matchAll(/(?:sb_secret_|[sr]k_live_)[A-Za-z0-9_-]{12,}/g)].length;
  for (const match of source.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try { if (JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url')).role === 'service_role') privilegedTokens++; } catch { /* Non-token strings are ignored. */ }
  }
}
checks.push({ name: 'sampled public JavaScript contains no privileged token or live private key literal', assets_scanned: assets.size, privileged_tokens_found: privilegedTokens, private_key_literals_found: privateKeyLiterals, status: assets.size && !privilegedTokens && !privateKeyLiterals ? 'PASS' : 'FAIL' });
const report = { checked_at: new Date().toISOString(), origin, mode: 'read-only public HTTPS GET; normal TLS verification', production_mutations: 0, scope_limit: 'Only assets referenced by inspected pages; no universal secret-exposure guarantee, no authenticated business smoke.', status: checks.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL', checks };
writeFileSync('docs/production-readiness/prelaunch20-http.json', JSON.stringify(report, null, 2) + '\n');
console.log(`${report.status} read-only HTTPS pages and sampled assets`);
if (report.status !== 'PASS') process.exitCode = 1;
