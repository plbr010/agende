// One bounded, read-only sample. No credentials, request bodies or customer data.
// This checks the frontend shell only; it is not business-flow acceptance.
const origin = new URL(process.argv[2] ?? 'https://agendeapp.online');
if (!['https://agendeapp.online', 'http://127.0.0.1:3000'].includes(origin.origin)
    || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
  throw new Error('Use the approved production origin or isolated localhost:3000');
}
const checks = [];
for (const path of ['/', '/login', '/recuperar-senha', '/descobrir']) {
  const started = performance.now();
  try {
    const response = await fetch(new URL(path, origin), {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Agende-readonly-availability-check' },
    });
    await response.body?.cancel();
    checks.push({ path, status: response.status, milliseconds: Math.round(performance.now() - started), passed: response.status === 200 });
  } catch {
    checks.push({ path, status: null, milliseconds: Math.round(performance.now() - started), passed: false, error: 'network_or_timeout' });
  }
}
console.log(JSON.stringify({ checked_at: new Date().toISOString(), origin: origin.origin, mode: 'four public GETs; no authenticated or business operations', passed: checks.every(check => check.passed), checks }, null, 2));
process.exitCode = checks.every(check => check.passed) ? 0 : 1;
