import assert from "node:assert/strict";
import test from "node:test";
import { isMasterAdminBootstrapEmail, masterAdminAllowlist } from "./bootstrap";

test("master admin allowlist is server-only and ignores profile-like casing", () => {
  const previous = process.env.AGENDE_MASTER_ADMIN_EMAILS;
  process.env.AGENDE_MASTER_ADMIN_EMAILS = " Dono@Agende.app , outro@agende.app ";
  try {
    assert.deepEqual(masterAdminAllowlist(), ["dono@agende.app", "outro@agende.app"]);
    assert.equal(isMasterAdminBootstrapEmail("DONO@agende.app"), true);
    assert.equal(isMasterAdminBootstrapEmail("cliente@agende.app"), false);
  } finally {
    if (previous == null) delete process.env.AGENDE_MASTER_ADMIN_EMAILS;
    else process.env.AGENDE_MASTER_ADMIN_EMAILS = previous;
  }
});
