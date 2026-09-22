import assert from "node:assert/strict";
import test from "node:test";
import { eligibleReviewAppointments, reviewDraftSchema } from "./validation";
import type { MyAppointment } from "@/lib/booking/queries";

const base: MyAppointment = {
  id: "0199a899-771d-7cb3-8d00-0a9d6c6fbf30",
  workspaceName: "Studio Aurora",
  slug: "studio-aurora",
  serviceName: "Corte",
  professionalName: "Ana",
  startsAt: "2026-09-20T12:00:00.000Z",
  endsAt: "2026-09-20T13:00:00.000Z",
  durationMinutes: 60,
  priceCents: 9000,
  status: "completed",
  timezone: "America/Sao_Paulo",
  customerNote: null,
  businessPhone: null,
};

test("review draft accepts 1-5 stars and normalizes an empty comment", () => {
  assert.deepEqual(reviewDraftSchema.parse({ appointmentId: base.id, rating: "5", comment: "  " }), {
    appointmentId: base.id,
    rating: 5,
    comment: null,
  });
  assert.equal(reviewDraftSchema.safeParse({ appointmentId: base.id, rating: 6, comment: "" }).success, false);
});

test("only completed appointments are eligible and newest comes first", () => {
  const older = { ...base, id: "0199a899-771d-7cb3-8d00-0a9d6c6fbf31", startsAt: "2026-09-18T12:00:00.000Z" };
  const scheduled = { ...base, id: "0199a899-771d-7cb3-8d00-0a9d6c6fbf32", status: "scheduled" };
  assert.deepEqual(eligibleReviewAppointments([older, scheduled, base]).map((item) => item.id), [base.id, older.id]);
});
