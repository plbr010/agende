import type { AppointmentStatus } from "@/lib/agenda/status";

export type AppointmentMetricSource = {
  status: AppointmentStatus;
  priceCents: number;
  serviceName: string;
  professionalName: string;
};

export type AppointmentSummary = {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  expectedRevenueCents: number;
  completedRevenueCents: number;
  pendingRevenueCents: number;
};

export type RankedMetric = {
  label: string;
  count: number;
  revenueCents: number;
};

export function monthBounds(localDate: string): { from: string; toExclusive: string } {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(localDate);
  if (!match) {
    throw new Error("invalid_local_date");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    toExclusive: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

export function summarizeAppointments(items: AppointmentMetricSource[]): AppointmentSummary {
  const active = items.filter((item) => item.status !== "cancelled" && item.status !== "no_show");
  const completed = items.filter((item) => item.status === "completed");
  const pending = items.filter((item) =>
    item.status === "scheduled" || item.status === "confirmed" || item.status === "in_progress",
  );

  return {
    total: items.length,
    completed: completed.length,
    cancelled: items.filter((item) => item.status === "cancelled").length,
    noShow: items.filter((item) => item.status === "no_show").length,
    expectedRevenueCents: active.reduce((sum, item) => sum + item.priceCents, 0),
    completedRevenueCents: completed.reduce((sum, item) => sum + item.priceCents, 0),
    pendingRevenueCents: pending.reduce((sum, item) => sum + item.priceCents, 0),
  };
}

export function rankAppointments(
  items: AppointmentMetricSource[],
  field: "serviceName" | "professionalName",
  limit = 5,
): RankedMetric[] {
  const groups = new Map<string, RankedMetric>();

  for (const item of items) {
    if (item.status === "cancelled" || item.status === "no_show") {
      continue;
    }
    const label = item[field];
    const current = groups.get(label) ?? { label, count: 0, revenueCents: 0 };
    current.count += 1;
    current.revenueCents += item.priceCents;
    groups.set(label, current);
  }

  return [...groups.values()]
    .sort((left, right) => right.count - left.count || right.revenueCents - left.revenueCents)
    .slice(0, Math.max(0, limit));
}
