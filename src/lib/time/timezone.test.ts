import assert from "node:assert/strict";
import test from "node:test";
import {
  addDaysIso,
  addMinutesIso,
  compareTime,
  formatDateInProductTz,
  formatDateInTimeZone,
  formatTimeInProductTz,
  formatTimeInTimeZone,
  isDateInHorizon,
  isSlotTooSoon,
  startOfLocalDayUtc,
  startOfNextLocalDayUtc,
  todayInProductTz,
  weekdayInProductTz,
  zonedWallTimeToUtc,
} from "./timezone";

test("Sao Paulo wall midnight is 03:00 UTC", () => {
  const utc = zonedWallTimeToUtc("2026-09-18", "00:00");
  assert.equal(utc.toISOString(), "2026-09-18T03:00:00.000Z");
  assert.equal(formatDateInProductTz(utc), "2026-09-18");
  assert.equal(formatTimeInProductTz(utc), "00:00");
});

test("end of Sao Paulo day stays on the same local date", () => {
  const utc = zonedWallTimeToUtc("2026-09-18", "23:30");
  assert.equal(utc.toISOString(), "2026-09-19T02:30:00.000Z");
  assert.equal(formatDateInProductTz(utc), "2026-09-18");
  assert.equal(formatTimeInProductTz(utc), "23:30");
});

test("weekday matches JS/Postgres DOW with Sunday = 0", () => {
  assert.equal(weekdayInProductTz(zonedWallTimeToUtc("2026-09-18", "09:00")), 5);
  assert.equal(weekdayInProductTz(zonedWallTimeToUtc("2026-09-20", "00:00")), 0);
  assert.equal(weekdayInProductTz(zonedWallTimeToUtc("2026-09-21", "23:59")), 1);
});

test("local day bounds do not leak into the previous or next date", () => {
  const start = startOfLocalDayUtc("2026-09-18");
  const next = startOfNextLocalDayUtc("2026-09-18");
  assert.equal(start.toISOString(), "2026-09-18T03:00:00.000Z");
  assert.equal(next.toISOString(), "2026-09-19T03:00:00.000Z");
  assert.equal(formatDateInProductTz(new Date(next.getTime() - 1)), "2026-09-18");
});

test("Manaus wall midnight is 04:00 UTC", () => {
  const utc = zonedWallTimeToUtc("2026-09-18", "00:00", "America/Manaus");
  assert.equal(utc.toISOString(), "2026-09-18T04:00:00.000Z");
  assert.equal(formatDateInTimeZone(utc, "America/Manaus"), "2026-09-18");
  assert.equal(formatTimeInTimeZone(utc, "America/Manaus"), "00:00");
});

test("lead buffer and horizon use workspace timezone", () => {
  const now = new Date("2026-09-18T17:10:00.000Z");
  assert.equal(isSlotTooSoon("2026-09-18T17:15:00.000Z", 30, now), true);
  assert.equal(isSlotTooSoon("2026-09-18T17:50:00.000Z", 30, now), false);
  assert.equal(isDateInHorizon("2026-09-18", "America/Sao_Paulo", 90, now), true);
  assert.equal(isDateInHorizon("2026-12-20", "America/Sao_Paulo", 90, now), false);
});

test("date arithmetic helpers stay calendar-safe", () => {
  assert.equal(addDaysIso("2026-09-30", 1), "2026-10-01");
  assert.match(todayInProductTz(zonedWallTimeToUtc("2026-09-18", "00:30")), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(compareTime("08:00", "12:00") < 0, true);
  assert.equal(compareTime("18:00", "18:00"), 0);
  assert.match(addMinutesIso("2026-09-18T12:00:00.000Z", 45), /12:45:00/);
});
