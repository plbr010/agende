import assert from "node:assert/strict";
import test from "node:test";
import { isOfficialMasterAdminEmail, OFFICIAL_MASTER_ADMIN_EMAIL } from "./bootstrap";

test("only the official owner email is recognized and env cannot expand it", () => {
  const previous = process.env.AGENDE_MASTER_ADMIN_EMAILS;
  process.env.AGENDE_MASTER_ADMIN_EMAILS = "intruso@agende.app,outro@agende.app";
  try {
    assert.equal(OFFICIAL_MASTER_ADMIN_EMAIL, "plbrpc@gmail.com");
    assert.equal(isOfficialMasterAdminEmail("PLBRPC@gmail.com"), true);
    assert.equal(isOfficialMasterAdminEmail(" plbrpc@gmail.com "), true);
    assert.equal(isOfficialMasterAdminEmail("intruso@agende.app"), false);
    assert.equal(isOfficialMasterAdminEmail("cliente@agende.app"), false);
  } finally {
    if (previous == null) delete process.env.AGENDE_MASTER_ADMIN_EMAILS;
    else process.env.AGENDE_MASTER_ADMIN_EMAILS = previous;
  }
});
