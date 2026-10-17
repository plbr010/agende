import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { parsePublicBookingDetails, sanitizeBookingError } from "./validation";
const id = "11111111-1111-4111-8111-111111111111";
const request = { slug: "salao-real", serviceId: id, professionalMemberId: id, startsAt: "2026-10-20T12:00:00Z", fullName: "Maria Silva", phone: "+5532999999999", email: "untrusted@invalid.test", customerNote: null };
const verified = { id, email: "verified@invalid.test", email_confirmed_at: "2026-10-01", is_anonymous: false };
function harness(user: unknown = verified, authError: unknown = null, rpcError: string | null = null) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const effects: string[] = [];
  const dependencies: Record<string, unknown> = {
    zod: { z }, "next/headers": { cookies: async () => ({ delete: (name: string) => effects.push(`delete:${name}`) }) },
    "next/cache": { revalidatePath: (path: string) => effects.push(path) }, "./draft": { BOOKING_DRAFT_COOKIE: "draft" },
    "@/lib/booking/ip": { hashClientIp: async () => { effects.push("ip"); return "synthetic-hash"; } },
    "@/lib/booking/queries": { parsePublicBookingConfirmation: () => ({ appointmentId: id }), parsePublicBookingCatalog() {} },
    "@/lib/booking/validation": { parsePublicBookingDetails, sanitizeBookingError },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: authError }) },
      rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { data: {}, error: rpcError ? { message: rpcError } : null }; } }) },
  };
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync("src/lib/booking/actions.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require(name: string) { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return { calls, effects, create: (exports as { createPublicAppointmentAction: (value: unknown) => Promise<{ error?: string; confirmation?: unknown }> }).createPublicAppointmentAction };
}
test("anonymous, unconfirmed, anonymous Auth sessions and failing authentication never reach booking RPC or side effects", async () => {
  for (const [user, error] of [[null, null], [{ ...verified, email_confirmed_at: null }, null], [{ ...verified, is_anonymous: true }, null], [{ ...verified, email: undefined }, null], [verified, { message: "expired token" }]] as const) {
    const h = harness(user, error);
    for (const input of [request, null]) assert.match((await h.create(input)).error ?? "", /Entre na sua conta/);
    assert.equal(h.calls.length, 0); assert.deepEqual(h.effects, []);
  }
});
test("authenticated booking rejects malformed selections, caller-supplied prices and client IDs", async () => {
  for (const input of [null, { ...request, serviceId: "bad" }, { ...request, startsAt: "bad" }, { ...request, slug: "../other" }, { ...request, priceCents: 1 }, { ...request, clientId: id }, { ...request, workspaceId: id }, { ...request, status: "confirmed" }]) {
    const h = harness(); assert.ok((await h.create(input)).error); assert.equal(h.calls.length, 0); assert.deepEqual(h.effects, []);
  }
});
test("booking forwards verified Auth email and authoritative selection only; no SaaS operation is performed", async () => {
  const h = harness(); const result = await h.create({ ...request, email: "not even an email" });
  assert.ok(result.confirmation); assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].name, "create_public_appointment"); assert.equal(h.calls[0].args.p_email, verified.email);
  assert.equal(h.calls[0].args.p_service_id, id); assert.equal(h.calls[0].args.p_professional_member_id, id);
  assert.ok(!Object.hasOwn(h.calls[0].args, "p_price_cents")); assert.ok(!Object.hasOwn(h.calls[0].args, "p_client_id"));
  assert.ok(h.effects.includes("delete:draft")); assert.ok(h.effects.includes("/cliente/agendamentos"));
});
test("slot conflicts from the database keep the draft and never report successful confirmation", async () => {
  const h = harness(verified, null, "slot_taken"); const result = await h.create(request);
  assert.ok(result.error); assert.equal(result.confirmation, undefined); assert.ok(!h.effects.includes("delete:draft"));
});
