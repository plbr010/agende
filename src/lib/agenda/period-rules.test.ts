import assert from "node:assert/strict";
import test from "node:test";
import {
  PERIOD_MESSAGES,
  describeBlockProblem,
  describePeriodProblem,
  hourCountLabel,
  planHourCopy,
  rangesOverlap,
} from "./period-rules";

const monday = { id: "a", startTime: "08:00", endTime: "12:00" };
const afternoon = { id: "b", startTime: "14:00", endTime: "18:00" };

test("start must come before end and touching ranges are allowed", () => {
  assert.equal(describePeriodProblem("09:00", "08:00", []), PERIOD_MESSAGES.order);
  assert.equal(describePeriodProblem("09:00", "09:00", []), PERIOD_MESSAGES.order);
  assert.equal(describePeriodProblem("", "10:00", []), PERIOD_MESSAGES.missing);
  assert.equal(describePeriodProblem("08:00", "12:00", []), null);
  assert.equal(rangesOverlap(8 * 60, 12 * 60, 12 * 60, 18 * 60), false);
  assert.equal(describePeriodProblem("12:00", "14:00", [monday]), null);
});

test("overlapping hours are rejected, including when editing another row", () => {
  assert.equal(describePeriodProblem("11:00", "15:00", [monday, afternoon]), PERIOD_MESSAGES.overlap);
  assert.equal(describePeriodProblem("08:30", "11:00", [monday, afternoon], "a"), null);
  assert.equal(describePeriodProblem("13:00", "15:00", [monday, afternoon], "a"), PERIOD_MESSAGES.overlap);
  assert.equal(describePeriodProblem("9:00", "10:00", [{ startTime: "08:00:00", endTime: "12:00:00" }]), PERIOD_MESSAGES.overlap);
});

test("a day off needs a date and only clashes with folgas on that date", () => {
  assert.equal(describeBlockProblem("ontem", "08:00", "12:00", []), PERIOD_MESSAGES.blockDate);
  assert.equal(
    describeBlockProblem("2026-10-15", "09:00", "11:00", [
      { id: "1", localDate: "2026-10-16", localStart: "09:00", localEnd: "11:00" },
    ]),
    null,
  );
  assert.equal(
    describeBlockProblem("2026-10-15", "09:00", "11:00", [
      { id: "1", localDate: "2026-10-15", localStart: "10:00", localEnd: "12:00" },
    ]),
    PERIOD_MESSAGES.overlap,
  );
});

test("copy fills only empty days and keeps every period", () => {
  const hours = [
    { weekday: 1, startTime: "08:00:00", endTime: "12:00:00" },
    { weekday: 1, startTime: "14:00:00", endTime: "18:00:00" },
    { weekday: 2, startTime: "09:00", endTime: "17:00" },
  ];
  const plan = planHourCopy(hours, 1, [0, 1, 2, 3]);
  assert.equal(plan.emptySource, false);
  assert.deepEqual(plan.targets, [
    { weekday: 0, startTime: "08:00", endTime: "12:00" },
    { weekday: 0, startTime: "14:00", endTime: "18:00" },
    { weekday: 3, startTime: "08:00", endTime: "12:00" },
    { weekday: 3, startTime: "14:00", endTime: "18:00" },
  ]);
  assert.deepEqual(planHourCopy([], 1, [0, 1]), { targets: [], emptySource: true });
  assert.equal(hourCountLabel(0), "Sem atendimento");
  assert.equal(hourCountLabel(1), "1 horário");
  assert.equal(hourCountLabel(2), "2 horários");
});
