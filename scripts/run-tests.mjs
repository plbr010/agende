import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return findTests(path);
    }

    return entry.isFile() && entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const testFiles = findTests("src");
testFiles.push("scripts/workspace-media-sql.test.mjs", "scripts/profiles-booking-whatsapp-sql.test.mjs");
testFiles.push("scripts/discovery-sql.test.mjs", "scripts/staging-auth-observer.test.mjs", "scripts/staging-auth-expiry-result.test.mjs", "scripts/client-phase2-sql.test.mjs");

if (testFiles.length === 0) {
  console.error("Nenhum arquivo de teste foi encontrado em src.");
  process.exit(1);
}

// Each SQL suite owns a WASM database. Bound workers to avoid exhausting memory
// on hosts with many logical CPUs; every suite still runs.
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=4", "--test-reporter=./scripts/test-category-reporter.mjs", ...testFiles, "scripts/database.test.mjs", "scripts/launch-readiness.test.mjs", "scripts/final-hardening.test.mjs", "scripts/action-sql-integration.test.mjs", "scripts/atomic-service-sql.test.mjs", "scripts/test-environment-safety.test.mjs", "scripts/stripe-edge.test.mjs", "scripts/commercial-model.test.mjs", "scripts/e2e-lib.test.mjs"], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
