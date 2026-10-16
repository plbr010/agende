import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { bookingDraftSchema, BOOKING_DRAFT_COOKIE, BOOKING_DRAFT_TTL, type BookingDraft } from "./draft";

const draft: BookingDraft = {
  slug: "luna",
  serviceId: "11111111-1111-4111-8111-111111111111",
  professionalMemberId: null,
  localDate: "2026-10-20",
  startsAt: "2026-10-20T17:30:00.000Z",
};

function load(slots: { slots: string[]; error?: string }) {
  const exports: { continueBookingAfterLogin?: (input: BookingDraft) => Promise<{ error: string }> } = {};
  let saved: string | null = null;
  let redirected: string | null = null;
  runInNewContext(
    ts.transpileModule(readFileSync("src/lib/booking/draft-actions.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      process,
      require(name: string) {
        if (name === "next/headers") {
          return { cookies: async () => ({ set(_name: string, value: string) { saved = value; } }) };
        }
        if (name === "next/navigation") {
          return { redirect(path: string) { redirected = path; throw new Error("REDIRECT"); } };
        }
        if (name === "./draft") return { bookingDraftSchema, BOOKING_DRAFT_COOKIE, BOOKING_DRAFT_TTL };
        if (name === "./actions") return { fetchPublicSlotsAction: async () => slots };
        throw new Error(name);
      },
    },
  );
  return {
    continue: exports.continueBookingAfterLogin!,
    saved: () => saved,
    redirected: () => redirected,
  };
}

test("login keeps the chosen time only after the server confirms it is still free", async () => {
  const missing = load({ slots: [] });
  const unavailable = await missing.continue(draft);
  assert.match(unavailable.error, /não está mais disponível/);
  assert.equal(missing.saved(), null);

  const failed = load({ slots: [], error: "Não foi possível concluir. Tente de novo." });
  const lookup = await failed.continue(draft);
  assert.equal(lookup.error, "Não foi possível concluir. Tente de novo.");
  assert.equal(failed.saved(), null);
  assert.equal(failed.redirected(), null);

  const ready = load({ slots: [draft.startsAt] });
  await assert.rejects(ready.continue(draft), /REDIRECT/);
  assert.equal(ready.redirected(), "/login?next=%2Fp%2Fluna%2Fagendar");
  assert.match(ready.saved() ?? "", /luna/);
});
