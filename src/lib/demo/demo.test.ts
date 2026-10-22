import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { canTransitionStatus } from "@/lib/agenda/status";
import { isBlockingStatus } from "@/lib/agenda/status";
import { DEMO_IDS, DEMO_NAME, DEMO_SLUG, DEMO_TIMEZONE, demoPublicCatalog } from "@/lib/demo/catalog";
import { demoEntries, demoReport, entriesInPeriod, financeSummary } from "@/lib/demo/project";
import { EMPTY_DEMO_SESSION, parseDemoSession, readDemoSession, writeDemoSession, type DemoSession } from "@/lib/demo/session";
import { buildAppointments, demoSlots, isDemoOpenDay, placeDemoAppointment } from "@/lib/demo/schedule";
import { DEMO_TRIAL_HREF, DEMO_PLANS_HREF } from "@/lib/demo/paths";
import { resolvePeriod } from "@/lib/modules/periods";
import { addDaysIso } from "@/lib/time/timezone";

const TODAY = "2026-10-22";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

test("thursday fixture day is open and sunday is closed", () => {
  assert.equal(isDemoOpenDay(TODAY), true);
  assert.equal(isDemoOpenDay("2026-10-25"), false);
});

test("demo slots follow the fictional jornada and block occupied times", () => {
  const appointments = buildAppointments(TODAY, EMPTY_DEMO_SESSION);
  const sunday = demoSlots({
    localDate: "2026-10-25",
    serviceId: DEMO_IDS.corte,
    professionalMemberId: DEMO_IDS.marina,
    appointments,
    now: new Date("2026-10-22T12:00:00.000Z"),
  });
  assert.deepEqual(sunday, []);
  const morning = demoSlots({
    localDate: "2026-10-23",
    serviceId: DEMO_IDS.corte,
    professionalMemberId: DEMO_IDS.marina,
    appointments,
    now: new Date("2026-10-22T12:00:00.000Z"),
  });
  assert.ok(morning.length > 0);
  const hidra = appointments.find((item) => item.id === DEMO_IDS.apptHidra);
  assert.ok(hidra);
  const occupied = demoSlots({
    localDate: hidra.localDate,
    serviceId: DEMO_IDS.corte,
    professionalMemberId: DEMO_IDS.marina,
    appointments,
    now: new Date("2026-10-01T12:00:00.000Z"),
  });
  assert.equal(occupied.some((slot) => Date.parse(slot) === Date.parse(hidra.startsAt)), false);
  assert.equal(isBlockingStatus("cancelled"), false);
});

test("a visitor booking stays in that session and frees no real identifier", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");
  const appointments = buildAppointments(TODAY, EMPTY_DEMO_SESSION);
  const slots = demoSlots({
    localDate: "2026-10-23",
    serviceId: DEMO_IDS.manicure,
    professionalMemberId: null,
    appointments,
    now,
  });
  const placed = placeDemoAppointment(TODAY, EMPTY_DEMO_SESSION, {
    serviceId: DEMO_IDS.manicure,
    professionalMemberId: null,
    localDate: "2026-10-23",
    startsAt: slots[0],
  }, now, { appointmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", financeEntryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1" });
  assert.equal(placed.error, undefined);
  assert.equal(placed.confirmation?.status, "scheduled");
  assert.equal(placed.confirmation?.guest, true);
  assert.equal(placed.confirmation?.businessPhone, null);
  assert.equal(placed.confirmation?.workspaceName, DEMO_NAME);
  assert.equal(placed.confirmation?.slug, DEMO_SLUG);
  assert.equal(placed.appointment?.source, "visitor");
  const next: DemoSession = {
    ...EMPTY_DEMO_SESSION,
    visitorAppointments: [placed.appointment!],
    highlightId: placed.appointment!.id,
  };
  const after = demoSlots({
    localDate: "2026-10-23",
    serviceId: DEMO_IDS.manicure,
    professionalMemberId: placed.appointment!.professionalMemberId,
    appointments: buildAppointments(TODAY, next),
    now,
  });
  assert.equal(after.some((slot) => Date.parse(slot) === Date.parse(slots[0])), false);
  const other = buildAppointments(TODAY, EMPTY_DEMO_SESSION);
  assert.equal(other.some((item) => item.id === placed.appointment!.id), false);
  const storage = memoryStorage();
  writeDemoSession(storage, next);
  const restored = readDemoSession(storage);
  assert.equal(restored.visitorAppointments.length, 1);
  writeDemoSession(storage, EMPTY_DEMO_SESSION);
  assert.equal(readDemoSession(storage).visitorAppointments.length, 0);
  assert.equal(readDemoSession(memoryStorage()).highlightId, null);
});

test("finance follows completed appointments and ignores package redemptions", () => {
  const appointments = buildAppointments(TODAY, EMPTY_DEMO_SESSION);
  const entries = demoEntries(TODAY, EMPTY_DEMO_SESSION, appointments);
  const manicure = entries.find((entry) => entry.clientName === "Helena Prado" && entry.source === "appointment");
  assert.equal(manicure, undefined);
  const month = resolvePeriod("month", TODAY);
  const visible = entriesInPeriod(entries, month.startDate, month.endDate);
  const summary = financeSummary(visible);
  const hidra = visible.find((entry) => entry.id === DEMO_IDS.financeHidra);
  assert.equal(hidra?.status, "paid");
  assert.equal(hidra?.amountCents, 15000);
  assert.ok(summary.paidRevenueCents >= 15000 + 16000);
  assert.equal(summary.balanceCents, summary.paidRevenueCents - summary.paidExpenseCents);
  const report = demoReport(TODAY, appointments, entries, month);
  assert.equal(report.packages.redemptions, 1);
  assert.equal(report.inventory.lowStock, 1);
  assert.equal(report.inventory.outOfStock, 1);
  assert.equal(report.period.timezone, DEMO_TIMEZONE);
});

test("completing a visitor appointment adds a pending income only in that session", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");
  const slots = demoSlots({
    localDate: "2026-10-23",
    serviceId: DEMO_IDS.corte,
    professionalMemberId: DEMO_IDS.marina,
    appointments: buildAppointments(TODAY, EMPTY_DEMO_SESSION),
    now,
  });
  const placed = placeDemoAppointment(TODAY, EMPTY_DEMO_SESSION, {
    serviceId: DEMO_IDS.corte,
    professionalMemberId: DEMO_IDS.marina,
    localDate: "2026-10-23",
    startsAt: slots[0],
  }, now, { appointmentId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1", financeEntryId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1" });
  const booked: DemoSession = { ...EMPTY_DEMO_SESSION, visitorAppointments: [placed.appointment!] };
  const before = demoEntries(TODAY, booked, buildAppointments(TODAY, booked));
  assert.equal(before.some((entry) => entry.id === placed.appointment!.financeEntryId), false);
  assert.equal(canTransitionStatus("scheduled", "completed", "owner"), false);
  assert.equal(canTransitionStatus("scheduled", "in_progress", "owner"), true);
  assert.equal(canTransitionStatus("in_progress", "completed", "owner"), true);
  const completed = { ...placed.appointment!, status: "completed" as const };
  const done: DemoSession = { ...booked, visitorAppointments: [completed] };
  const pending = demoEntries(TODAY, done, buildAppointments(TODAY, done)).find((entry) => entry.id === completed.financeEntryId);
  assert.equal(pending?.status, "pending");
  assert.equal(pending?.amountCents, 12000);
  const paid: DemoSession = { ...done, paidEntryIds: [completed.financeEntryId!], payments: { [completed.financeEntryId!]: "pix" } };
  const received = demoEntries(TODAY, paid, buildAppointments(TODAY, paid)).find((entry) => entry.id === completed.financeEntryId);
  assert.equal(received?.status, "paid");
  assert.equal(received?.paymentMethodLabel, "Pix");
});

test("corrupt demo storage cannot revive another session", () => {
  assert.equal(parseDemoSession({ version: 2, visitorAppointments: [{ id: "x" }] }).visitorAppointments.length, 0);
  assert.equal(parseDemoSession("nope").guideDismissed, false);
  const catalog = demoPublicCatalog();
  assert.equal(catalog.slug, DEMO_SLUG);
  assert.equal(catalog.services.length, 6);
  assert.equal(DEMO_TRIAL_HREF, "/cadastro?intent=professional");
  assert.equal(DEMO_PLANS_HREF, "/profissionais#planos");
  assert.equal(addDaysIso(TODAY, 1), "2026-10-23");
});

test("demo modules do not touch production clients", () => {
  const files = [
    ...walk("src/lib/demo"),
    ...walk("src/components/demo"),
    ...walk("src/app/demo"),
  ].filter((file) => !file.endsWith(".test.ts"));
  const banned = [/createClient\(/, /@\/lib\/supabase/, /managementAction/, /stripe/, /service_role/, /signOutAction/, /createPublicAppointmentAction/, /fetchPublicSlotsAction/];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of banned) {
      assert.equal(pattern.test(source), false, `${file} matches ${pattern}`);
    }
  }
});
