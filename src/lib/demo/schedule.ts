import { isBlockingStatus, type AppointmentStatus } from "@/lib/agenda/status";
import { BOOKING_MIN_LEAD_MINUTES } from "@/lib/booking/config";
import type { PublicBookingConfirmation } from "@/lib/booking/queries";
import {
  DEMO_BREAK_END,
  DEMO_BREAK_START,
  DEMO_DAY_END,
  DEMO_DAY_START,
  DEMO_IDS,
  DEMO_NAME,
  DEMO_OPEN_WEEKDAYS,
  DEMO_PROFESSIONALS,
  DEMO_SLUG,
  DEMO_TIMEZONE,
  DEMO_VISITOR,
  professionalById,
  serviceById,
  type DemoAppointment,
} from "@/lib/demo/catalog";
import type { DemoSession } from "@/lib/demo/session";
import {
  addDaysIso,
  formatTimeInTimeZone,
  isSlotTooSoon,
  SLOT_STEP_MINUTES,
  weekdayInTimeZone,
  zonedWallTimeToUtc,
} from "@/lib/time/timezone";

export function isDemoOpenDay(localDate: string): boolean {
  const weekday = weekdayInTimeZone(zonedWallTimeToUtc(localDate, "12:00", DEMO_TIMEZONE), DEMO_TIMEZONE);
  return (DEMO_OPEN_WEEKDAYS as readonly number[]).includes(weekday);
}

export function adjacentOpenDay(localDate: string, direction: 1 | -1, count: number): string {
  let cursor = localDate;
  let found = 0;
  while (found < count) {
    cursor = addDaysIso(cursor, direction);
    if (isDemoOpenDay(cursor)) found += 1;
  }
  return cursor;
}

export function previousMonthOpenDay(today: string): string {
  let cursor = addDaysIso(`${today.slice(0, 7)}-01`, -1);
  while (!isDemoOpenDay(cursor)) cursor = addDaysIso(cursor, -1);
  return cursor;
}

function span(localDate: string, start: string, durationMinutes: number) {
  const starts = zonedWallTimeToUtc(localDate, start, DEMO_TIMEZONE);
  const ends = new Date(starts.getTime() + durationMinutes * 60_000);
  return {
    startsAt: starts.toISOString(),
    endsAt: ends.toISOString(),
    localDate,
    localStart: start,
    localEnd: formatTimeInTimeZone(ends, DEMO_TIMEZONE),
  };
}

function appointment(partial: Omit<DemoAppointment, "startsAt" | "endsAt" | "localDate" | "localStart" | "localEnd"> & {
  localDate: string;
  localStart: string;
}): DemoAppointment {
  return { ...partial, ...span(partial.localDate, partial.localStart, partial.durationMinutes) };
}

function named(serviceId: string, professionalId: string) {
  const service = serviceById(serviceId);
  const professional = professionalById(professionalId);
  if (!service || !professional) throw new Error("demo_catalog_incomplete");
  return { service, professional };
}

/** Fixed fictional week. Dates move with "today" so the agenda stays current, without random values. */
export function seedAppointments(today: string): DemoAppointment[] {
  const past1 = adjacentOpenDay(today, -1, 1);
  const past2 = adjacentOpenDay(today, -1, 2);
  const next1 = adjacentOpenDay(today, 1, 1);
  const older = previousMonthOpenDay(today);
  const olderCut = named(DEMO_IDS.corte, DEMO_IDS.marina);
  const hidra = named(DEMO_IDS.hidratacao, DEMO_IDS.marina);
  const manicure = named(DEMO_IDS.manicure, DEMO_IDS.ana);
  const pedicure = named(DEMO_IDS.pedicure, DEMO_IDS.ana);
  const escova = named(DEMO_IDS.escova, DEMO_IDS.marina);
  const brow = named(DEMO_IDS.sobrancelha, DEMO_IDS.livia);
  const rows: DemoAppointment[] = [
    appointment({
      id: DEMO_IDS.apptOlder,
      clientId: DEMO_IDS.camila,
      clientName: "Camila Duarte",
      professionalMemberId: olderCut.professional.id,
      professionalName: olderCut.professional.displayName,
      serviceId: olderCut.service.id,
      serviceName: olderCut.service.name,
      status: "completed",
      priceCents: olderCut.service.priceCents,
      durationMinutes: olderCut.service.durationMinutes,
      notes: null,
      source: "seed",
      settledByPackage: false,
      financeEntryId: DEMO_IDS.financeOlder,
      localDate: older,
      localStart: "10:00",
    }),
    appointment({
      id: DEMO_IDS.apptHidra,
      clientId: DEMO_IDS.beatriz,
      clientName: "Beatriz Lemos",
      professionalMemberId: hidra.professional.id,
      professionalName: hidra.professional.displayName,
      serviceId: hidra.service.id,
      serviceName: hidra.service.name,
      status: "completed",
      priceCents: hidra.service.priceCents,
      durationMinutes: hidra.service.durationMinutes,
      notes: null,
      source: "seed",
      settledByPackage: false,
      financeEntryId: DEMO_IDS.financeHidra,
      localDate: past1,
      localStart: "10:00",
    }),
    appointment({
      id: DEMO_IDS.apptManicure,
      clientId: DEMO_IDS.helena,
      clientName: "Helena Prado",
      professionalMemberId: manicure.professional.id,
      professionalName: manicure.professional.displayName,
      serviceId: manicure.service.id,
      serviceName: manicure.service.name,
      status: "completed",
      priceCents: manicure.service.priceCents,
      durationMinutes: manicure.service.durationMinutes,
      notes: "Sessão do pacote de manicure.",
      source: "seed",
      settledByPackage: true,
      financeEntryId: null,
      localDate: past1,
      localStart: "14:00",
    }),
    appointment({
      id: DEMO_IDS.apptCancelled,
      clientId: DEMO_IDS.camila,
      clientName: "Camila Duarte",
      professionalMemberId: olderCut.professional.id,
      professionalName: olderCut.professional.displayName,
      serviceId: olderCut.service.id,
      serviceName: olderCut.service.name,
      status: "cancelled",
      priceCents: olderCut.service.priceCents,
      durationMinutes: olderCut.service.durationMinutes,
      notes: null,
      source: "seed",
      settledByPackage: false,
      financeEntryId: null,
      localDate: past2,
      localStart: "16:00",
    }),
    appointment({
      id: DEMO_IDS.apptNoShow,
      clientId: DEMO_IDS.beatriz,
      clientName: "Beatriz Lemos",
      professionalMemberId: hidra.professional.id,
      professionalName: hidra.professional.displayName,
      serviceId: hidra.service.id,
      serviceName: hidra.service.name,
      status: "no_show",
      priceCents: hidra.service.priceCents,
      durationMinutes: hidra.service.durationMinutes,
      notes: null,
      source: "seed",
      settledByPackage: false,
      financeEntryId: null,
      localDate: past2,
      localStart: "09:00",
    }),
    appointment({
      id: DEMO_IDS.apptSobrancelha,
      clientId: DEMO_IDS.olivia,
      clientName: "Olívia Martins",
      professionalMemberId: brow.professional.id,
      professionalName: brow.professional.displayName,
      serviceId: brow.service.id,
      serviceName: brow.service.name,
      status: "confirmed",
      priceCents: brow.service.priceCents,
      durationMinutes: brow.service.durationMinutes,
      notes: null,
      source: "seed",
      settledByPackage: false,
      financeEntryId: demoIdSafe(DEMO_IDS.apptSobrancelha),
      localDate: next1,
      localStart: "11:00",
    }),
  ];
  if (isDemoOpenDay(today)) {
    rows.push(
      appointment({
        id: DEMO_IDS.apptPedicure,
        clientId: DEMO_IDS.rita,
        clientName: "Rita Nogueira",
        professionalMemberId: pedicure.professional.id,
        professionalName: pedicure.professional.displayName,
        serviceId: pedicure.service.id,
        serviceName: pedicure.service.name,
        status: "in_progress",
        priceCents: pedicure.service.priceCents,
        durationMinutes: pedicure.service.durationMinutes,
        notes: null,
        source: "seed",
        settledByPackage: false,
        financeEntryId: demoIdSafe(DEMO_IDS.apptPedicure),
        localDate: today,
        localStart: "09:30",
      }),
      appointment({
        id: DEMO_IDS.apptEscova,
        clientId: DEMO_IDS.beatriz,
        clientName: "Beatriz Lemos",
        professionalMemberId: escova.professional.id,
        professionalName: escova.professional.displayName,
        serviceId: escova.service.id,
        serviceName: escova.service.name,
        status: "scheduled",
        priceCents: escova.service.priceCents,
        durationMinutes: escova.service.durationMinutes,
        notes: null,
        source: "seed",
        settledByPackage: false,
        financeEntryId: demoIdSafe(DEMO_IDS.apptEscova),
        localDate: today,
        localStart: "15:00",
      }),
    );
  }
  return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function demoIdSafe(appointmentId: string): string {
  return `10000000-0000-4000-8000-${appointmentId.slice(-12)}`;
}

export function buildAppointments(today: string, session: DemoSession): DemoAppointment[] {
  const seed = seedAppointments(today).map((item) => {
    const status = session.statusOverrides[item.id];
    return status ? { ...item, status } : item;
  });
  return [...seed, ...session.visitorAppointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

export function demoSlots(input: {
  localDate: string;
  serviceId: string;
  professionalMemberId: string | null;
  appointments: readonly DemoAppointment[];
  now?: Date;
}): string[] {
  const service = serviceById(input.serviceId);
  if (!service || !isDemoOpenDay(input.localDate)) return [];
  const people = input.professionalMemberId
    ? DEMO_PROFESSIONALS.filter((person) => person.id === input.professionalMemberId && person.serviceIds.includes(service.id))
    : DEMO_PROFESSIONALS.filter((person) => person.serviceIds.includes(service.id));
  if (people.length === 0) return [];
  const now = input.now ?? new Date();
  const breakStart = zonedWallTimeToUtc(input.localDate, DEMO_BREAK_START, DEMO_TIMEZONE).getTime();
  const breakEnd = zonedWallTimeToUtc(input.localDate, DEMO_BREAK_END, DEMO_TIMEZONE).getTime();
  const open = minutes(DEMO_DAY_START);
  const close = minutes(DEMO_DAY_END);
  const slots = new Set<string>();
  for (const person of people) {
    for (let cursor = open; cursor + service.durationMinutes <= close; cursor += SLOT_STEP_MINUTES) {
      const startIso = zonedWallTimeToUtc(input.localDate, fromMinutes(cursor), DEMO_TIMEZONE).toISOString();
      const startMs = Date.parse(startIso);
      const endMs = startMs + service.durationMinutes * 60_000;
      if (overlaps(startMs, endMs, breakStart, breakEnd)) continue;
      if (isSlotTooSoon(startIso, BOOKING_MIN_LEAD_MINUTES, now)) continue;
      const busy = input.appointments.some((item) =>
        item.professionalMemberId === person.id
        && item.localDate === input.localDate
        && isBlockingStatus(item.status)
        && overlaps(startMs, endMs, Date.parse(item.startsAt), Date.parse(item.endsAt)),
      );
      if (!busy) slots.add(startIso);
    }
  }
  return [...slots].sort((a, b) => Date.parse(a) - Date.parse(b));
}

function minutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function fromMinutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function placeDemoAppointment(
  today: string,
  session: DemoSession,
  input: {
    serviceId: string;
    professionalMemberId: string | null;
    localDate: string;
    startsAt: string;
  },
  now = new Date(),
  ids: { appointmentId: string; financeEntryId: string } = {
    appointmentId: crypto.randomUUID(),
    financeEntryId: crypto.randomUUID(),
  },
): { error?: string; appointment?: DemoAppointment; confirmation?: PublicBookingConfirmation } {
  const service = serviceById(input.serviceId);
  if (!service) return { error: "Escolha serviço, profissional e horário." };
  const appointments = buildAppointments(today, session);
  const wanted = Date.parse(input.startsAt);
  if (Number.isNaN(wanted)) return { error: "Escolha serviço, profissional e horário." };
  const candidates = input.professionalMemberId
    ? DEMO_PROFESSIONALS.filter((person) => person.id === input.professionalMemberId)
    : [...DEMO_PROFESSIONALS];
  const professional = candidates.find((person) =>
    person.serviceIds.includes(service.id)
    && demoSlots({
      localDate: input.localDate,
      serviceId: service.id,
      professionalMemberId: person.id,
      appointments,
      now,
    }).some((slot) => Date.parse(slot) === wanted),
  );
  if (!professional) {
    if (input.professionalMemberId && !professionalById(input.professionalMemberId)?.serviceIds.includes(service.id)) {
      return { error: "Essa profissional não atende mais este serviço. Escolha outra pessoa." };
    }
    return { error: "Esse horário foi ocupado enquanto você entrava. Escolha outro." };
  }
  const starts = new Date(wanted);
  const ends = new Date(wanted + service.durationMinutes * 60_000);
  const appointmentRow: DemoAppointment = {
    id: ids.appointmentId,
    clientId: DEMO_VISITOR.id,
    clientName: DEMO_VISITOR.fullName,
    professionalMemberId: professional.id,
    professionalName: professional.displayName,
    serviceId: service.id,
    serviceName: service.name,
    startsAt: starts.toISOString(),
    endsAt: ends.toISOString(),
    status: "scheduled" satisfies AppointmentStatus,
    priceCents: service.priceCents,
    durationMinutes: service.durationMinutes,
    notes: null,
    localDate: input.localDate,
    localStart: formatTimeInTimeZone(starts, DEMO_TIMEZONE),
    localEnd: formatTimeInTimeZone(ends, DEMO_TIMEZONE),
    source: "visitor",
    settledByPackage: false,
    financeEntryId: ids.financeEntryId,
  };
  return {
    appointment: appointmentRow,
    confirmation: {
      appointmentId: appointmentRow.id,
      workspaceName: DEMO_NAME,
      slug: DEMO_SLUG,
      serviceName: appointmentRow.serviceName,
      professionalName: appointmentRow.professionalName,
      startsAt: appointmentRow.startsAt,
      endsAt: appointmentRow.endsAt,
      durationMinutes: appointmentRow.durationMinutes,
      priceCents: appointmentRow.priceCents,
      timezone: DEMO_TIMEZONE,
      status: "scheduled",
      businessPhone: null,
      guest: true,
    },
  };
}
