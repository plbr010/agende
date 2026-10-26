import { test } from "node:test";
import assert from "node:assert/strict";
import { isInactiveWorkspaceError, workspaceSettingsFieldError } from "./settings-errors";

test("database validation produces field errors without leaking private details", () => {
  for (const [code, field] of [["workspace_settings_phone_format", "businessPhone"], ["invalid_address", "address"], ["invalid_city", "city"], ["invalid_state", "state"], ["invalid_postal_code", "postalCode"], ["invalid_timezone", "timezone"]]) {
    const result = workspaceSettingsFieldError(`private details: ${code}`);
    assert.ok(result?.fieldErrors[field]);
    assert.ok(!JSON.stringify(result).includes("private details"));
  }
  assert.equal(workspaceSettingsFieldError("network unavailable"), null);
});

test("an expired entitlement is recognized without treating other failures as inactive", () => {
  assert.equal(isInactiveWorkspaceError(new Error("Supabase RPC get_finance_ui failed: workspace_subscription_inactive")), true);
  assert.equal(isInactiveWorkspaceError(new Error("permission denied for table appointments")), false);
  assert.equal(isInactiveWorkspaceError("workspace_subscription_inactive"), false);
});
