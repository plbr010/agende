import test from "node:test";
import assert from "node:assert/strict";
import { bookingDraftSchema, decodeBookingDraft, BOOKING_DRAFT_TTL } from "./draft";
const selection = { slug: "salao-a", serviceId: "11111111-1111-4111-8111-111111111111", professionalMemberId: null, localDate: "2026-10-20", startsAt: "2026-10-20T12:00:00Z" };
test("draft preserves selection and rejects wrong salon expiry malformed IDs and personal data", () => {
  assert.deepEqual(decodeBookingDraft(JSON.stringify({ selection, expiresAt: Date.now()+60000 }), "salao-a"), selection);
  for (const raw of ["bad",JSON.stringify({selection,expiresAt:Date.now()-1}),JSON.stringify({selection,expiresAt:Date.now()+BOOKING_DRAFT_TTL*2000})]) assert.equal(decodeBookingDraft(raw,"salao-a"),null);
  assert.equal(decodeBookingDraft(JSON.stringify({selection,expiresAt:Date.now()+60000}),"salao-b"),null);
  assert.equal(bookingDraftSchema.safeParse({...selection,email:"private@test.invalid"}).success,false);
  assert.equal(bookingDraftSchema.safeParse({...selection,serviceId:"bad"}).success,false);
});
