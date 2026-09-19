export const PRODUCT_TIMEZONE = "America/Sao_Paulo";
export const SLOT_STEP_MINUTES = 15;

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PRODUCT_TIMEZONE,
  weekday: "short",
});

const datePartFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PRODUCT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timePartFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: PRODUCT_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateTimePartFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PRODUCT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partsMap(formatter: Intl.DateTimeFormat, value: Date): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(value)) {
    if (part.type !== "literal") {
      parts[part.type] = part.value;
    }
  }
  return parts;
}

/** Interpreta data+hora de parede no fuso do produto e devolve UTC. */
export function zonedWallTimeToUtc(
  date: string,
  time: string,
  timeZone: string = PRODUCT_TIMEZONE,
): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("invalid_date");
  }
  const timeMatch = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!timeMatch) {
    throw new Error("invalid_time");
  }

  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? "0");
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error("invalid_time");
  }

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = partsMap(formatter, new Date(utcGuess));
  const asIf = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(utcGuess - (asIf - utcGuess));
}

export function formatDateInProductTz(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return datePartFormatter.format(date);
}

export function formatTimeInProductTz(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return timePartFormatter.format(date);
}

export function formatDateTimeInProductTz(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: PRODUCT_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function weekdayInProductTz(value: Date | string): number {
  const date = typeof value === "string" ? new Date(value) : value;
  const short = weekdayFormatter.format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[short] ?? -1;
}

export function addDaysIso(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day + days);
  const next = new Date(utc);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayInProductTz(now: Date = new Date()): string {
  return formatDateInProductTz(now);
}

export function startOfLocalDayUtc(date: string): Date {
  return zonedWallTimeToUtc(date, "00:00:00");
}

export function startOfNextLocalDayUtc(date: string): Date {
  return zonedWallTimeToUtc(addDaysIso(date, 1), "00:00:00");
}

export function compareTime(start: string, end: string): number {
  const toMin = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };
  return toMin(start) - toMin(end);
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function parseTimeInput(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatDateInTimeZone(value: Date | string, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatTimeInTimeZone(value: Date | string, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return formatDateInTimeZone(now, timeZone);
}

export function weekdayInTimeZone(value: Date | string, timeZone: string): number {
  const date = typeof value === "string" ? new Date(value) : value;
  const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[short] ?? -1;
}

export function formatDateTimeInTimeZone(value: Date | string, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export function isSlotTooSoon(
  startsAtIso: string,
  minLeadMinutes: number,
  now: Date = new Date(),
): boolean {
  return new Date(startsAtIso).getTime() < now.getTime() + minLeadMinutes * 60_000;
}

export function isDateInHorizon(
  localDate: string,
  timeZone: string,
  horizonDays: number,
  now: Date = new Date(),
): boolean {
  const today = todayInTimeZone(timeZone, now);
  if (localDate < today) {
    return false;
  }
  return localDate <= addDaysIso(today, horizonDays);
}
