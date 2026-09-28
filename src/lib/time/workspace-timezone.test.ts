import test from "node:test";
import assert from "node:assert/strict";
import { formatDateInTimeZone, formatTimeInTimeZone, startOfLocalDayUtc, startOfNextLocalDayUtc, todayInTimeZone, zonedWallTimeToUtc } from "./timezone";

test("same appointment instant renders and round-trips correctly in two workspace zones", () => {
  const instant = "2026-10-12T13:00:00.000Z";
  for (const [zone, time] of [["America/Sao_Paulo", "10:00"], ["America/Manaus", "09:00"], ["America/Rio_Branco", "08:00"]]) {
    assert.equal(formatTimeInTimeZone(instant, zone), time);
    assert.equal(zonedWallTimeToUtc(formatDateInTimeZone(instant, zone), time, zone).toISOString(), instant);
  }
});
test("workspace day filters and today respect different midnight boundaries", () => {
  const instant = new Date("2026-10-12T03:30:00Z");
  assert.equal(todayInTimeZone("America/Sao_Paulo", instant), "2026-10-12");
  assert.equal(todayInTimeZone("America/Manaus", instant), "2026-10-11");
  assert.equal(startOfLocalDayUtc("2026-10-12", "America/Manaus").toISOString(), "2026-10-12T04:00:00.000Z");
  assert.equal(startOfNextLocalDayUtc("2026-10-12", "America/Sao_Paulo").toISOString(), "2026-10-13T03:00:00.000Z");
});
