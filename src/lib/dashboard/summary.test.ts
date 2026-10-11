import assert from "node:assert/strict";
import test from "node:test";
import { getAppNavigation } from "@/config/app-navigation";
import {
  averageRating,
  buildMonthGrid,
  dayCount,
  dayRevenueCents,
  formatRatingPt,
  parseMonthParam,
  percentChange,
  shiftMonth,
  upcomingAppointments,
} from "./summary";

const items = [
  { localDate: "2026-10-10", status: "completed" as const, priceCents: 8000 },
  { localDate: "2026-10-11", status: "confirmed" as const, priceCents: 12000 },
  { localDate: "2026-10-11", status: "no_show" as const, priceCents: 5000 },
  { localDate: "2026-10-11", status: "cancelled" as const, priceCents: 9000 },
  { localDate: "2026-10-12", status: "scheduled" as const, priceCents: 7000 },
  { localDate: "2026-10-13", status: "cancelled" as const, priceCents: 1000 },
];

test("day totals ignore cancelled visits and leave no-shows out of the money", () => {
  assert.equal(dayCount(items, "2026-10-11"), 2);
  assert.equal(dayRevenueCents(items, "2026-10-11"), 12000);
  assert.equal(dayCount(items, "2026-10-10"), 1);
});

test("percent change stays empty when yesterday has nothing to compare", () => {
  assert.equal(percentChange(8, 0), null);
  assert.equal(percentChange(12, 10), 20);
  assert.equal(percentChange(8, 10), -20);
});

test("rating average uses real notes only", () => {
  assert.equal(averageRating([]), null);
  assert.equal(averageRating([5, 4, 5]), 4.7);
  assert.equal(formatRatingPt(4.7), "4,7");
});

test("upcoming list keeps the next open visits after today", () => {
  const upcoming = upcomingAppointments(items, "2026-10-11", 4);
  assert.deepEqual(upcoming.map((item) => item.localDate), ["2026-10-12"]);
});

test("month grid starts on Sunday and marks today", () => {
  const weeks = buildMonthGrid("2026-10", "2026-10-11", new Set(["2026-10-11", "2026-10-12"]));
  assert.equal(weeks[0][0].iso, "2026-09-27");
  assert.equal(weeks[0][4].iso, "2026-10-01");
  assert.equal(weeks[2][0].isToday, true);
  assert.equal(weeks[2][0].hasAppointment, true);
  assert.equal(weeks[2][1].hasAppointment, true);
});

test("month navigation rejects invalid cursors", () => {
  assert.equal(parseMonthParam("2026-13", "2026-10-11"), "2026-10");
  assert.equal(parseMonthParam("hoje", "2026-10-11"), "2026-10");
  assert.equal(parseMonthParam("2026-09", "2026-10-11"), "2026-09");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});

test("owner menu follows the reference and still reaches avaliações", () => {
  const labels = getAppNavigation("owner").flatMap((group) => group.items.map((item) => item.label));
  assert.deepEqual(labels, [
    "Início",
    "Agenda",
    "Clientes",
    "Serviços",
    "Equipe",
    "Estoque",
    "Pacotes",
    "Financeiro",
    "Relatórios",
    "Avaliações",
  ]);
});
