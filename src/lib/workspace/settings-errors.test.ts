import { test } from "node:test";
import assert from "node:assert/strict";
import { workspaceSettingsFieldError } from "./settings-errors";

test("database validation produces field errors without leaking private details", () => {
  for (const [code, field] of [["workspace_settings_phone_format", "businessPhone"], ["invalid_address", "address"], ["invalid_city", "city"], ["invalid_state", "state"], ["invalid_postal_code", "postalCode"], ["invalid_timezone", "timezone"]]) {
    const result = workspaceSettingsFieldError(`private details: ${code}`);
    assert.ok(result?.fieldErrors[field]);
    assert.ok(!JSON.stringify(result).includes("private details"));
  }
  assert.equal(workspaceSettingsFieldError("network unavailable"), null);
});
