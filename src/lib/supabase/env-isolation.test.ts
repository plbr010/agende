import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function backend(env: Record<string, string>, browser = false) {
  const source = readFileSync(new URL("./env.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exports = {} as { getSupabaseUrl: () => string };
  runInNewContext(outputText, { exports, URL, process: { env }, ...(browser ? { window: {} } : {}) });
  return exports.getSupabaseUrl();
}
const production = "https://wohimauqgywshbbejjcl.supabase.co";

test("preview and local production-mode builds cannot initialize the production backend", () => {
  for (const deployment of ["preview", "development", "", "staging"]) {
    assert.throws(() => backend({ NEXT_PUBLIC_SUPABASE_URL: production, NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV: deployment, NODE_ENV: "production" }), /forbidden/);
  }
  assert.throws(() => backend({ NEXT_PUBLIC_SUPABASE_URL: production, VERCEL_ENV: "production" }), /forbidden/);
});
test("production access requires the build class and rejects a preview runtime", () => {
  assert.equal(backend({ NEXT_PUBLIC_SUPABASE_URL: production, NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV: "production", VERCEL_ENV: "production", VERCEL: "1" }), production);
  // Browser bundle has no private VERCEL_ENV but retains the baked public class.
  assert.equal(backend({ NEXT_PUBLIC_SUPABASE_URL: production, NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV: "production" }, true), production);
  assert.throws(() => backend({ NEXT_PUBLIC_SUPABASE_URL: production, NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV: "production" }), /forbidden/);
  assert.throws(() => backend({ NEXT_PUBLIC_SUPABASE_URL: production, NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV: "production", VERCEL_ENV: "preview" }), /forbidden/);
});
test("browser preview guard also rejects the DNS trailing-dot form of production", () => {
  assert.throws(() => backend({ NEXT_PUBLIC_SUPABASE_URL: production + ".", NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV: "preview" }, true), /forbidden/);
  assert.throws(() => backend({ NEXT_PUBLIC_SUPABASE_URL: production, NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV: "development" }, true), /forbidden/);
});
test("isolated HTTPS and local Supabase work while malformed origins fail closed", () => {
  for (const url of ["https://staging.supabase.co", "http://127.0.0.1:54321"]) {
    assert.equal(backend({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV: "preview" }), url);
  }
  for (const url of ["https://user:secret@staging.supabase.co", "https://staging.supabase.co/path", "https://staging.supabase.co?x=y", "http://staging.supabase.co"]) {
    assert.throws(() => backend({ NEXT_PUBLIC_SUPABASE_URL: url }), /Invalid/);
  }
  assert.throws(() => backend({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV: "production" }), /Invalid/);
});

test("server site origin uses runtime configuration while browser keeps baked public origin", () => {
  const source = readFileSync(new URL("./env.ts", import.meta.url), "utf8");
  for (const browser of [false, true]) {
    const exports = {} as { getSiteUrl: () => string };
    runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
      { exports, URL, process: { env: { SITE_URL: "http://127.0.0.1:3456", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" } },
        ...(browser ? { window: {} } : {}) });
    assert.equal(exports.getSiteUrl(), browser ? "http://localhost:3000" : "http://127.0.0.1:3456");
  }
});
