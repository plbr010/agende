import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOTS = ["src", "supabase/functions"];

function* runtimeFiles(directory: string): Generator<string> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* runtimeFiles(path);
    } else if (
      entry.isFile() &&
      /\.tsx?$/.test(entry.name) &&
      !/\.(?:test|spec|d)\.ts$/.test(entry.name)
    ) {
      yield path;
    }
  }
}

test("serverless runtime uses the pooled Supabase HTTPS API, never unpooled SQL clients", () => {
  // "pg" is used by local SQL test tooling, not by deployed Next.js or Edge code.
  // A new direct driver must be explicitly reviewed and migrated to the managed
  // transaction pooler before it is allowed in serverless runtime sources.
  const driverImport =
    /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["'](?:pg(?:\/[^"']*)?|postgres(?:\/[^"']*)?|@prisma\/client|@vercel\/postgres|drizzle-orm\/(?:node-postgres|postgres-js))["']/;
  const directConnectionEnv =
    /\b(?:DATABASE_URL|POSTGRES_URL|POSTGRES_URL_NON_POOLING|POSTGRES_PRISMA_URL|PGHOST)\b/;
  const directPostgresUrl = /postgres(?:ql)?:\/\//i;

  for (const root of ROOTS) {
    for (const path of runtimeFiles(root)) {
      const source = readFileSync(path, "utf8");
      assert.doesNotMatch(source, driverImport, `Direct SQL driver in serverless runtime: ${path}`);
      assert.doesNotMatch(source, directConnectionEnv, `Direct connection variable in serverless runtime: ${path}`);
      assert.doesNotMatch(source, directPostgresUrl, `Raw PostgreSQL URI in serverless runtime: ${path}`);
    }
  }
});

test("local Supavisor pooler is enabled with bounded transaction-mode capacity", () => {
  const config = readFileSync("supabase/config.toml", "utf8");
  const pooler = config.match(/^\[db\.pooler\]([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1];
  assert.ok(pooler, "Missing local Supavisor configuration");
  assert.match(pooler, /^enabled\s*=\s*true$/m);
  assert.match(pooler, /^pool_mode\s*=\s*"transaction"$/m);
  const poolSize = Number(pooler.match(/^default_pool_size\s*=\s*(\d+)$/m)?.[1]);
  const clientLimit = Number(pooler.match(/^max_client_conn\s*=\s*(\d+)$/m)?.[1]);
  assert.ok(Number.isInteger(poolSize) && poolSize > 0 && poolSize <= 20);
  assert.ok(Number.isInteger(clientLimit) && clientLimit >= poolSize && clientLimit <= 100);
});
