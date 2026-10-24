import assert from "node:assert/strict";
import test from "node:test";
import { commissionSettingsSchema, commissionsUiSchema, formatRate, percentToBps, permissionEditorSchema } from "./queries";

test("percent input becomes integer basis points and prints one decimal", () => {
  assert.equal(percentToBps("40"), 4000);
  assert.equal(percentToBps("40,5"), 4050);
  assert.equal(percentToBps("0"), 0);
  assert.equal(percentToBps("100"), 10000);
  assert.equal(percentToBps("40.55"), null);
  assert.equal(percentToBps("101"), null);
  assert.equal(percentToBps(""), null);
  assert.equal(formatRate(4000), "40%");
  assert.equal(formatRate(4050), "40,5%");
});

test("commission screens accept the payload shape returned by the database", () => {
  const ui = commissionsUiSchema.parse({
    viewer: "team",
    entries: [{
      id: "11111111-1111-4111-8111-111111111111",
      appointment_id: "22222222-2222-4222-8222-222222222222",
      professional_member_id: "33333333-3333-4333-8333-333333333333",
      professional_name: "Ana",
      service_name: "Corte",
      client_name: "Bia",
      starts_at: "2026-10-23T14:00:00Z",
      rate_bps: 2500,
      eligible_cents: 8000,
      original_cents: 2000,
      current_cents: 1500,
      released_cents: 1500,
      paid_cents: 1000,
      status: "adjusted",
      release_policy: "on_receipt",
      manual_ceiling_cents: null,
      created_at: "2026-10-23T15:00:00Z",
      events: [],
      payments: [{
        id: "44444444-4444-4444-8444-444444444444",
        direction: "payout",
        amount_cents: 1000,
        paid_on: "2026-10-23",
        note: null,
        created_at: "2026-10-23T16:00:00Z",
      }],
    }],
  });
  assert.equal(ui.entries[0]?.current_cents, 1500);

  const settings = commissionSettingsSchema.parse({
    release_policy: "on_receipt",
    rules: [{
      id: "55555555-5555-4555-8555-555555555555",
      professional_member_id: "33333333-3333-4333-8333-333333333333",
      professional_name: "Ana",
      service_id: null,
      service_name: null,
      rate_bps: 2500,
      effective_from: "2026-10-23T12:00:00Z",
    }],
  });
  assert.equal(settings.rules[0]?.service_name, null);

  const editor = permissionEditorSchema.parse({
    members: [{
      member_id: "33333333-3333-4333-8333-333333333333",
      full_name: "Ana",
      role: "professional",
      editable: true,
      permissions: [{ key: "commissions.view_own", effective: true, source: "default" }],
    }],
  });
  assert.equal(editor.members[0]?.editable, true);
});
