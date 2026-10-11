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

if (testFiles.length === 0) {
  console.error("Nenhum arquivo de teste foi encontrado em src.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "--test-reporter=./scripts/test-category-reporter.mjs", ...testFiles, "scripts/database.test.mjs", "scripts/launch-readiness.test.mjs", "scripts/final-hardening.test.mjs", "scripts/action-sql-integration.test.mjs", "scripts/atomic-service-sql.test.mjs", "scripts/test-environment-safety.test.mjs", "scripts/stripe-edge.test.mjs"], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
