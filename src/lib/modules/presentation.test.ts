import assert from "node:assert/strict";
import test from "node:test";
import { monthBounds, rankAppointments, summarizeAppointments } from "./presentation";

const appointments = [
  { status: "completed" as const, priceCents: 12000, serviceName: "Corte", professionalName: "Ana" },
  { status: "confirmed" as const, priceCents: 8000, serviceName: "Escova", professionalName: "Bia" },
  { status: "scheduled" as const, priceCents: 12000, serviceName: "Corte", professionalName: "Ana" },
  { status: "cancelled" as const, priceCents: 5000, serviceName: "Unhas", professionalName: "Bia" },
];

test("month bounds cross the year without relying on server timezone", () => {
  assert.deepEqual(monthBounds("2026-12-18"), {
    from: "2026-12-01",
    toExclusive: "2027-01-01",
  });
});

test("appointment summary separates realized and pending revenue", () => {
  assert.deepEqual(summarizeAppointments(appointments), {
    total: 4,
    completed: 1,
    cancelled: 1,
    noShow: 0,
    expectedRevenueCents: 32000,
    completedRevenueCents: 12000,
    pendingRevenueCents: 20000,
  });
});

test("ranking ignores cancelled appointments and sorts by volume", () => {
  assert.deepEqual(rankAppointments(appointments, "serviceName"), [
    { label: "Corte", count: 2, revenueCents: 24000 },
    { label: "Escova", count: 1, revenueCents: 8000 },
  ]);
});
