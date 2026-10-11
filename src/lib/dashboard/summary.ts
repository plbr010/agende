import type { AppointmentStatus } from "@/lib/agenda/status";
import { addDaysIso, startOfLocalDayUtc } from "@/lib/time/timezone";

type DatedStatus = {
  localDate: string;
  status: AppointmentStatus;
};

export type AppointmentSnapshot = DatedStatus & {
  priceCents: number;
};

export type CalendarDay = {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  hasAppointment: boolean;
};

const UPCOMING_STATUSES: readonly AppointmentStatus[] = ["scheduled", "confirmed", "in_progress"];

export function isOpenAppointment(status: AppointmentStatus): boolean {
  return status !== "cancelled";
}

export function countsTowardRevenue(status: AppointmentStatus): boolean {
  return status !== "cancelled" && status !== "no_show";
}

export function daySnapshots<T extends DatedStatus>(items: readonly T[], date: string): T[] {
  return items.filter((item) => item.localDate === date && isOpenAppointment(item.status));
}

export function dayCount(items: readonly AppointmentSnapshot[], date: string): number {
  return daySnapshots(items, date).length;
}

export function dayRevenueCents(items: readonly AppointmentSnapshot[], date: string): number {
  return daySnapshots(items, date)
    .filter((item) => countsTowardRevenue(item.status))
    .reduce((sum, item) => sum + item.priceCents, 0);
}

/** Percent change against a previous day. Null when there is no baseline to compare. */
export function percentChange(current: number, baseline: number): number | null {
  if (baseline <= 0) {
    return null;
  }
  return Math.round(((current - baseline) / baseline) * 100);
}

export function averageRating(ratings: readonly number[]): number | null {
  if (ratings.length === 0) {
    return null;
  }
  const value = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  return Math.round(value * 10) / 10;
}

export function formatRatingPt(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function upcomingAppointments<T extends DatedStatus>(
  items: readonly T[],
  todayIso: string,
  limit = 4,
): T[] {
  return items
    .filter((item) => item.localDate > todayIso && UPCOMING_STATUSES.includes(item.status))
    .slice(0, limit);
}

export function parseMonthParam(value: string | undefined, todayIso: string): string {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return value;
    }
  }
  return todayIso.slice(0, 7);
}

export function shiftMonth(monthIso: string, delta: number): string {
  const year = Number(monthIso.slice(0, 4));
  const month = Number(monthIso.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthTitle(monthIso: string): string {
  const year = Number(monthIso.slice(0, 4));
  const month = Number(monthIso.slice(5, 7));
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDashboardDate(isoDate: string, timeZone: string): string {
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(startOfLocalDayUtc(isoDate, timeZone));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function buildMonthGrid(
  monthIso: string,
  todayIso: string,
  occupied: ReadonlySet<string>,
): CalendarDay[][] {
  const year = Number(monthIso.slice(0, 4));
  const month = Number(monthIso.slice(5, 7));
  const first = `${monthIso}-01`;
  const leading = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: CalendarDay[] = [];

  for (let index = 0; index < leading; index += 1) {
    const iso = addDaysIso(first, index - leading);
    cells.push(toCalendarDay(iso, todayIso, occupied, false));
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${monthIso}-${String(day).padStart(2, "0")}`;
    cells.push(toCalendarDay(iso, todayIso, occupied, true));
  }
  while (cells.length % 7 !== 0) {
    const iso = addDaysIso(first, cells.length - leading);
    cells.push(toCalendarDay(iso, todayIso, occupied, false));
  }

  const weeks: CalendarDay[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

export function rangeCovering(dates: readonly string[]): { from: string; toExclusive: string } {
  const sorted = [...dates].sort();
  const from = sorted[0];
  const last = sorted[sorted.length - 1];
  return { from, toExclusive: addDaysIso(last, 1) };
}

function toCalendarDay(
  iso: string,
  todayIso: string,
  occupied: ReadonlySet<string>,
  inMonth: boolean,
): CalendarDay {
  return {
    iso,
    day: Number(iso.slice(8, 10)),
    inMonth,
    isToday: iso === todayIso,
    hasAppointment: occupied.has(iso),
  };
}
