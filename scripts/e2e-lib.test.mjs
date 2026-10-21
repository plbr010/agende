import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  FORBIDDEN_PRODUCTION_HOSTS,
  STAGING_ACCEPTANCE,
  assertSafeE2eOrigin,
  createEvidenceDir,
  exitCodeFromResults,
  isAllowedStagingOrigin,
  isForbiddenProductionOrigin,
  resolveStagingConfig,
  scanEnvForProduction,
  writeSummary,
} from "./e2e-lib.mjs";

test("production hosts used by the live site are always refused", () => {
  for (const host of [
    "https://agendeapp.online",
    "https://www.agendeapp.online/p/x",
    "https://agende-lac.vercel.app",
    "https://wohimauqgywshbbejjcl.supabase.co",
    "https://preview.wohimauqgywshbbejjcl.supabase.co",
  ]) {
    assert.equal(isForbiddenProductionOrigin(host), true);
    assert.throws(() => assertSafeE2eOrigin(host), /produção/);
  }
  assert.equal(isForbiddenProductionOrigin("http://127.0.0.1:3109"), false);
  assert.equal(isForbiddenProductionOrigin("https://fkpdudnnperufnmdwdlv.supabase.co"), false);
  assert.ok(FORBIDDEN_PRODUCTION_HOSTS.includes("agendeapp.online"));
});

test("staging origins accept loopback and staging hostnames only", () => {
  assert.equal(isAllowedStagingOrigin("http://127.0.0.1:3000"), true);
  assert.equal(isAllowedStagingOrigin("http://localhost:3000"), true);
  assert.equal(isAllowedStagingOrigin("https://agende-staging.example"), true);
  assert.equal(isAllowedStagingOrigin("https://agendeapp.online"), false);
  assert.equal(isAllowedStagingOrigin("https://agende-lac.vercel.app"), false);
  assert.equal(isAllowedStagingOrigin("https://user:pass@127.0.0.1"), false);
  assert.equal(isAllowedStagingOrigin("https://random.vercel.app"), false);
});

test("staging config is BLOQUEADO without opt-in and FAIL on production", () => {
  assert.deepEqual(resolveStagingConfig({}).result, "BLOQUEADO");
  assert.equal(resolveStagingConfig({}).ready, false);
  const prod = resolveStagingConfig({
    AGENDE_STAGING_ORIGIN: "https://agendeapp.online",
    AGENDE_STAGING_ACCEPTANCE: STAGING_ACCEPTANCE,
  });
  assert.equal(prod.result, "FAIL");
  assert.equal(prod.ready, false);
  const ready = resolveStagingConfig({
    AGENDE_STAGING_ORIGIN: "http://127.0.0.1:3000",
    AGENDE_STAGING_ACCEPTANCE: STAGING_ACCEPTANCE,
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.origin, "http://127.0.0.1:3000");
  assert.equal(ready.allowMutations, false);
});

test("evidence directories stay under the workspace or an explicit override", () => {
  const cwd = mkdtempSync(join(tmpdir(), "agende-e2e-"));
  try {
    const nested = createEvidenceDir("isolated", {}, cwd);
    assert.match(nested.dir, /artifacts[/\\]e2e[/\\]isolated-/);
    assert.doesNotMatch(nested.dir, /\/opt\/cursor/);
    const custom = createEvidenceDir("staging", { AGENDE_E2E_EVIDENCE: "tmp-evidence" }, cwd);
    assert.match(custom.dir, /tmp-evidence[/\\]staging-/);
    const path = writeSummary(custom.dir, { ok: true });
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { ok: true });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("exit codes distinguish test failure, missing browser and missing backend", () => {
  assert.equal(exitCodeFromResults({}), 0);
  assert.equal(exitCodeFromResults({ fail: 1 }), 1);
  assert.equal(exitCodeFromResults({ missingBrowser: true }), 2);
  assert.equal(exitCodeFromResults({ missingBackend: true }), 3);
  assert.equal(exitCodeFromResults({ fail: 2, missingBrowser: true }), 1);
  assert.deepEqual(scanEnvForProduction({
    NEXT_PUBLIC_SITE_URL: "https://agendeapp.online",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  }), ["NEXT_PUBLIC_SITE_URL"]);
});

test('isolated evidence never labels failed or blocked runs as PASS',async()=>{
 const {classifyLocalE2e}=await import('./e2e-lib.mjs');
 assert.match(classifyLocalE2e([{result:'PASS'}]),/^PASS/);
 assert.match(classifyLocalE2e([{result:'PASS'},{result:'FAIL'}]),/^FAIL/);
 assert.match(classifyLocalE2e([{result:'BLOQUEADO'}]),/^BLOQUEADO/);
});
