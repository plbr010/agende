import assert from "node:assert/strict";
import test from "node:test";
import { clientPhoneNotice } from "./phone-notice";

test("missing and local phones explain the WhatsApp problem", () => {
  assert.match(clientPhoneNotice(null) ?? "", /não tem telefone/);
  assert.match(clientPhoneNotice("  ") ?? "", /não tem telefone/);
  assert.match(clientPhoneNotice("(32) 99999-9999") ?? "", /formato internacional/);
  assert.equal(clientPhoneNotice("+55 (32) 99999-9999"), null);
});
