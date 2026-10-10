import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { safeRequestOrigin } from "./safe-origin";

function siteUrl(env: Record<string, string>) {
  const source = readFileSync(new URL("../supabase/env.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exports = {} as { getSiteUrl: () => string };
  runInNewContext(outputText, { exports, URL, process: { env } });
  return exports.getSiteUrl();
}

test("Vercel production without explicit site URL never sends Auth links to localhost", () => {
  const origin = siteUrl({ VERCEL: "1", VERCEL_ENV: "production", VERCEL_URL: "agende-deployment.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "agende-lac.vercel.app" });
  assert.equal(origin, "https://agende-lac.vercel.app");
  assert.equal(safeRequestOrigin("https://evil.invalid", origin), origin);
});

test("preview uses its own deployment host and explicit configuration still wins", () => {
  assert.equal(siteUrl({ VERCEL: "1", VERCEL_ENV: "preview", VERCEL_URL: "agende-preview.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "agende-lac.vercel.app" }), "https://agende-preview.vercel.app");
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://agende.example/", VERCEL_URL: "agende-preview.vercel.app" }), "https://agende.example");
  assert.equal(siteUrl({}), "http://localhost:3000");
});

test("deployed origins reject missing configuration and malformed values", () => {
  assert.throws(() => siteUrl({ VERCEL: "1" }), /site|Site|SITE/);
  for (const value of ["https://user:password@agende.example", "https://agende.example/path", "javascript:alert(1)", "https://agende.example?next=evil"]) {
    assert.throws(() => siteUrl({ NEXT_PUBLIC_SITE_URL: value }));
  }
});
