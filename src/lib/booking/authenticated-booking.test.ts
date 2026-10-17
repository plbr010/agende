import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { parsePublicBookingCatalog, parsePublicBookingConfirmation } from "@/lib/booking/queries";
import { parsePublicBookingDetails, sanitizeBookingError } from "@/lib/booking/validation";

const input = {
  slug: "luna",
  serviceId: "11111111-1111-4111-8111-111111111111",
  professionalMemberId: null,
  startsAt: "2026-10-20T17:30:00.000Z",
  fullName: "Maria Silva",
  phone: "32999999999",
  email: "maria@example.com",
  customerNote: null,
};

function loadAction(user: { id: string; email: string; email_confirmed_at: string | null } | null) {
  const exports: { createPublicAppointmentAction?: (value: typeof input) => Promise<{ error?: string; confirmation?: unknown }> } = {};
  let rpcCalls = 0;
  runInNewContext(
    ts.transpileModule(readFileSync("src/lib/booking/actions.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require(name: string) {
        const modules: Record<string, unknown> = {
          zod: { z },
          "next/headers": { cookies: async () => ({ delete() {} }) },
          "next/cache": { revalidatePath() {} },
          "./draft": { BOOKING_DRAFT_COOKIE: "agende_booking_draft" },
          "@/lib/supabase/server": {
            createClient: async () => ({
              auth: { getUser: async () => ({ data: { user } }) },
              rpc: async () => {
                rpcCalls += 1;
                return { data: null, error: null };
              },
            }),
          },
          "@/lib/booking/queries": {
            loadMyAppointmentsResult: async () => ({ appointments: [], error: null }),
            parsePublicBookingConfirmation,
            parsePublicBookingCatalog,
          },
          "@/lib/booking/ip": { hashClientIp: async () => "hash" },
          "@/lib/booking/validation": { parsePublicBookingDetails, sanitizeBookingError },
        };
        if (name in modules) return modules[name];
        throw new Error(name);
      },
    },
  );
  return {
    calls: () => rpcCalls,
    create: exports.createPublicAppointmentAction!,
  };
}

test("public booking action rejects anonymous and unconfirmed sessions before any RPC", async () => {
  for (const user of [null, { id: "user", email: "maria@example.com", email_confirmed_at: null }]) {
    const action = loadAction(user);
    const result = await action.create(input);
    assert.equal(result.error, "Entre na sua conta para confirmar o agendamento.");
    assert.equal(result.confirmation, undefined);
    assert.equal(action.calls(), 0);
  }
});

test("confirmed public booking migration refuses to continue as a guest", () => {
  const sql = readFileSync("supabase/migrations/20261016235000_require_confirmed_public_booking.sql", "utf8");
  assert.match(sql, /RAISE EXCEPTION 'not_authenticated'/);
  assert.match(sql, /RAISE EXCEPTION 'email_not_confirmed'/);
  assert.doesNotMatch(sql, /v_uid\s*:=\s*NULL/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.create_public_appointment[\s\S]*FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.create_public_appointment[\s\S]*TO authenticated/);
  assert.doesNotMatch(sql, /TO anon/);
});
