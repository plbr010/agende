import { readFileSync } from "node:fs";
import { createLocalDatabase } from "./local-database.mjs";

// Explicitly local: no connection strings, remote credentials or network clients.
// Every suite runs in a transaction rolled back even if a test fails.
const db = await createLocalDatabase();
let failed = false;
try {
  await db.exec("set time zone 'America/Sao_Paulo'");
  await db.exec(readFileSync("supabase/tests/helpers.sql", "utf8"));
  for (const suite of ["foundation", "catalog", "workspace_settings", "agenda", "public_booking"]) {
    await db.exec("begin");
    try {
      // Legacy helpers delete whole workspaces, which interacts with entitlement
      // and audit triggers. Isolation here is transaction rollback, not DELETE.
      const sql = readFileSync(`supabase/tests/${suite}.sql`, "utf8")
        .replace(/PERFORM test_helpers\.cleanup\([^;]*\);/g, "-- Isolated transaction: rollback performs cleanup.");
      const results = await db.exec(sql);
      console.log(JSON.stringify({ suite, result: "PASS", evidence: results.flatMap(r => r.rows) }));
    } catch (error) {
      failed = true;
      console.log(JSON.stringify({ suite, result: "FAIL", error: error.message, detail: error.where }));
    } finally {
      await db.exec("rollback");
    }
  }
} finally {
  await db.close();
}
process.exitCode = failed ? 1 : 0;
