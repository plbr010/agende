import assert from "node:assert/strict";
import test from "node:test";
import {
  canRescheduleStatus,
  canTransitionStatus,
  endsAtFromStart,
  isBlockingStatus,
  isTerminalStatus,
  resolveServiceSnapshot,
  statusActions,
} from "../agenda/status";
import {
  appointmentCreateSchema,
  parseAppointmentCreateForm,
  parseWorkingPeriodForm,
  workingPeriodSchema,
} from "./agenda";

test("override wins over catalog price and duration", () => {
  const service = { priceCents: 8000, durationMinutes: 60 };
  assert.deepEqual(resolveServiceSnapshot(service, null), service);
  assert.deepEqual(
    resolveServiceSnapshot(service, {
      priceOverrideCents: 10000,
      durationOverrideMinutes: 45,
      active: true,
    }),
    { priceCents: 10000, durationMinutes: 45 },
  );
  assert.deepEqual(
    resolveServiceSnapshot(service, {
      priceOverrideCents: 10000,
      durationOverrideMinutes: 45,
      active: false,
    }),
    service,
  );
  assert.deepEqual(
    resolveServiceSnapshot(service, {
      priceOverrideCents: null,
      durationOverrideMinutes: 90,
      active: true,
    }),
    { priceCents: 8000, durationMinutes: 90 },
  );
});

test("endsAt is start plus snapshot duration", () => {
  assert.equal(endsAtFromStart("2026-09-18T12:00:00.000Z", 45), "2026-09-18T12:45:00.000Z");
  assert.equal(endsAtFromStart("2026-09-18T12:00:00.000Z", 60), "2026-09-18T13:00:00.000Z");
});

test("status transitions keep snapshots untouched and block terminal edits", () => {
  assert.equal(isBlockingStatus("scheduled"), true);
  assert.equal(isBlockingStatus("cancelled"), false);
  assert.equal(isBlockingStatus("no_show"), false);
  assert.equal(isTerminalStatus("completed"), true);
  assert.equal(canRescheduleStatus("completed"), false);
  assert.equal(canRescheduleStatus("scheduled"), true);
  assert.equal(canTransitionStatus("scheduled", "confirmed", "receptionist"), true);
  assert.equal(canTransitionStatus("scheduled", "in_progress", "receptionist"), false);
  assert.equal(canTransitionStatus("scheduled", "in_progress", "professional"), true);
  assert.equal(canTransitionStatus("completed", "scheduled", "owner"), false);
  assert.deepEqual(statusActions("in_progress", "owner"), ["completed", "cancelled"]);
});

test("appointment form does not accept a browser-supplied price", () => {
  const form = new FormData();
  form.set("clientId", "11111111-1111-4111-8111-111111111111");
  form.set("professionalMemberId", "11111111-1111-4111-8111-111111111112");
  form.set("serviceId", "11111111-1111-4111-8111-111111111113");
  form.set("localDate", "2026-09-21");
  form.set("startsAt", "2026-09-21T12:00:00.000Z");
  form.set("priceCents", "1");
  const parsed = parseAppointmentCreateForm(form);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal("priceCents" in parsed.data, false);
  }
  assert.equal(
    appointmentCreateSchema.safeParse({
      clientId: "not-a-uuid",
      professionalMemberId: "11111111-1111-4111-8111-111111111112",
      serviceId: "11111111-1111-4111-8111-111111111113",
      localDate: "2026-09-21",
      startsAt: "2026-09-21T12:00:00.000Z",
    }).success,
    false,
  );
});

test("working period requires start before end and weekday 0-6", () => {
  assert.equal(
    workingPeriodSchema.safeParse({
      memberId: "11111111-1111-4111-8111-111111111111",
      weekday: 1,
      startTime: "08:00",
      endTime: "12:00",
    }).success,
    true,
  );
  assert.equal(
    workingPeriodSchema.safeParse({
      memberId: "11111111-1111-4111-8111-111111111111",
      weekday: 1,
      startTime: "12:00",
      endTime: "08:00",
    }).success,
    false,
  );
  assert.equal(
    workingPeriodSchema.safeParse({
      memberId: "11111111-1111-4111-8111-111111111111",
      weekday: 7,
      startTime: "08:00",
      endTime: "12:00",
    }).success,
    false,
  );

  const form = new FormData();
  form.set("memberId", "11111111-1111-4111-8111-111111111111");
  form.set("weekday", "0");
  form.set("startTime", "9:00");
  form.set("endTime", "12:30");
  const parsed = parseWorkingPeriodForm(form);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.startTime, "09:00");
    assert.equal(parsed.data.weekday, 0);
  }
});
