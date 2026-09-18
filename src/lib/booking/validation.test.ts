import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOKING_HORIZON_DAYS,
  BOOKING_MIN_LEAD_MINUTES,
  BOOKING_STEPS,
  CLIENT_CANCEL_LEAD_MINUTES,
} from "./config";
import {
  canClientCancel,
  nextBookingStep,
  parsePublicBookingDetails,
  partitionClientAppointments,
  previousBookingStep,
  sanitizeBookingError,
} from "./validation";
import { bookingWhatsAppText, buildIcs, buildWhatsAppLink } from "./calendar";
import { parsePublicBookingCatalog, parseMyAppointments, parsePublicBookingConfirmation } from "./queries";

test("booking details normalize email, phone and optional note", () => {
  const parsed = parsePublicBookingDetails({
    fullName: "  Maria Silva ",
    phone: "(32) 99999-9999",
    email: "Maria@Example.com",
    customerNote: "",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.fullName, "Maria Silva");
    assert.equal(parsed.data.phone, "+5532999999999");
    assert.equal(parsed.data.email, "maria@example.com");
    assert.equal(parsed.data.customerNote, null);
  }
});

test("omitted booking fields are rejected", () => {
  const parsed = parsePublicBookingDetails({
    fullName: null,
    phone: null,
    email: null,
    customerNote: null,
  });
  assert.equal(parsed.success, false);
});

test("rejects invalid email and too-long customer note", () => {
  const email = parsePublicBookingDetails({
    fullName: "Ana",
    phone: "32988887777",
    email: "nao-e-email",
  });
  assert.equal(email.success, false);
  const note = parsePublicBookingDetails({
    fullName: "Ana",
    phone: "32988887777",
    email: "ana@test.com",
    customerNote: "x".repeat(501),
  });
  assert.equal(note.success, false);
});

test("keeps DDD 55 on booking phone", () => {
  const parsed = parsePublicBookingDetails({
    fullName: "Ana",
    phone: "5532999887766",
    email: "ana@test.com",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.phone, "+5532999887766");
  }
});

test("step helpers move forward and back without wrapping past service", () => {
  assert.equal(nextBookingStep("service"), "professional");
  assert.equal(nextBookingStep("confirm"), "success");
  assert.equal(previousBookingStep("service"), "service");
  assert.equal(previousBookingStep("slot"), "date");
  assert.deepEqual([...BOOKING_STEPS], ["service", "professional", "date", "slot", "details", "confirm"]);
});

test("client cancel helpers respect terminal status and 2h lead", () => {
  const now = new Date("2026-09-18T15:00:00.000Z");
  assert.equal(canClientCancel("scheduled", "2026-09-18T18:00:00.000Z", CLIENT_CANCEL_LEAD_MINUTES, now).ok, true);
  assert.equal(canClientCancel("scheduled", "2026-09-18T16:30:00.000Z", CLIENT_CANCEL_LEAD_MINUTES, now).ok, false);
  assert.equal(canClientCancel("completed", "2026-09-18T18:00:00.000Z", CLIENT_CANCEL_LEAD_MINUTES, now).reason, "terminal");
  assert.equal(canClientCancel("in_progress", "2026-09-18T18:00:00.000Z", CLIENT_CANCEL_LEAD_MINUTES, now).reason, "in_progress");
});

test("sanitize booking errors never leak internals", () => {
  assert.match(sanitizeBookingError("slot_taken"), /acabou de ser reservado/);
  assert.match(sanitizeBookingError("booking_rate_limited"), /Muitas tentativas/);
  assert.equal(sanitizeBookingError("something unexpected sql"), "Não foi possível concluir. Tente de novo.");
});

test("catalog parser drops private fields", () => {
  const parsed = parsePublicBookingCatalog({
    name: "Luna",
    slug: "luna",
    timezone: "America/Manaus",
    services: [{ id: "s1", name: "Corte", duration_minutes: 45, price_cents: 8000, min_price_cents: 7000, max_price_cents: 9000 }],
    professionals: [{ id: "p1", display_name: "Ana", bio: "Hair", service_ids: ["s1"], offerings: [{ service_id: "s1", price_cents: 7000, duration_minutes: 40 }] }],
    business_email: "hidden@example.com",
  });
  assert.ok(parsed);
  assert.equal(parsed?.timezone, "America/Manaus");
  assert.equal("business_email" in (parsed ?? {}), false);
  assert.equal(parsed?.services[0]?.minPriceCents, 7000);
  assert.equal(parsed?.professionals[0]?.offerings[0]?.priceCents, 7000);
});

test("my appointments parser keeps only safe fields", () => {
  const parsed = parseMyAppointments([
    {
      id: "a1",
      workspace_name: "Luna",
      slug: "luna",
      service_name: "Corte",
      professional_name: "Ana",
      starts_at: "2026-09-20T12:00:00.000Z",
      ends_at: "2026-09-20T12:45:00.000Z",
      duration_minutes: 45,
      price_cents: 8000,
      status: "scheduled",
      timezone: "America/Sao_Paulo",
      notes: "nota interna",
      customer_note: "quero franja",
    },
  ]);
  assert.equal(parsed.length, 1);
  assert.equal("notes" in parsed[0], false);
  assert.equal(parsed[0]?.customerNote, "quero franja");
});

test("whatsapp and ics helpers stay local", () => {
  const link = buildWhatsAppLink("+5532999999999", "Oi");
  assert.equal(link, "https://wa.me/5532999999999?text=Oi");
  const ics = buildIcs({
    title: "Corte",
    description: "Agende",
    startsAt: "2026-09-20T12:00:00.000Z",
    endsAt: "2026-09-20T12:45:00.000Z",
  });
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(bookingWhatsAppText({ serviceName: "Corte", startsAt: "2026-09-20T12:00:00.000Z", timezone: "America/Sao_Paulo" }), /Corte/);
});

test("central booking rules stay at product constants", () => {
  assert.equal(BOOKING_MIN_LEAD_MINUTES, 30);
  assert.equal(BOOKING_HORIZON_DAYS, 90);
  assert.equal(CLIENT_CANCEL_LEAD_MINUTES, 120);
});

test("partition splits upcoming and past without mixing terminal statuses", () => {
  const now = new Date("2026-09-18T15:00:00.000Z");
  const { upcoming, past } = partitionClientAppointments(
    [
      { startsAt: "2026-09-18T18:00:00.000Z", status: "scheduled" },
      { startsAt: "2026-09-18T18:00:00.000Z", status: "cancelled" },
      { startsAt: "2026-09-18T12:00:00.000Z", status: "completed" },
    ],
    now,
  );
  assert.equal(upcoming.length, 1);
  assert.equal(past.length, 2);
});

test("confirmation parser keeps receipt fields only", () => {
  const parsed = parsePublicBookingConfirmation({
    appointment_id: "a1",
    workspace_name: "Luna",
    slug: "luna",
    service_name: "Corte",
    professional_name: "Ana",
    starts_at: "2026-09-20T12:00:00.000Z",
    ends_at: "2026-09-20T12:45:00.000Z",
    duration_minutes: 45,
    price_cents: 8000,
    timezone: "America/Manaus",
    status: "scheduled",
    guest: true,
    notes: "secreto",
  });
  assert.ok(parsed);
  assert.equal(parsed?.guest, true);
  assert.equal(parsed?.timezone, "America/Manaus");
  assert.equal("notes" in (parsed ?? {}), false);
});
