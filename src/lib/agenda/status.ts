import type { MemberRole } from "@/lib/catalog/queries";

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const BLOCKING_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
];

export const TERMINAL_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  "completed",
  "cancelled",
  "no_show",
];

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Falta",
};

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["confirmed", "in_progress", "cancelled", "no_show"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
};

const RECEPTIONIST_TARGETS: AppointmentStatus[] = ["confirmed", "cancelled", "no_show"];

export function isAppointmentStatus(value: string): value is AppointmentStatus {
  return (APPOINTMENT_STATUSES as readonly string[]).includes(value);
}

export function isBlockingStatus(status: AppointmentStatus): boolean {
  return BLOCKING_APPOINTMENT_STATUSES.includes(status);
}

export function isTerminalStatus(status: AppointmentStatus): boolean {
  return TERMINAL_APPOINTMENT_STATUSES.includes(status);
}

export function canRescheduleStatus(status: AppointmentStatus): boolean {
  return status === "scheduled" || status === "confirmed";
}

export function canTransitionStatus(
  from: AppointmentStatus,
  to: AppointmentStatus,
  role: MemberRole,
): boolean {
  if (from === to) {
    return true;
  }
  if (!TRANSITIONS[from].includes(to)) {
    return false;
  }
  if (role === "receptionist") {
    return RECEPTIONIST_TARGETS.includes(to);
  }
  return role === "owner" || role === "admin" || role === "professional";
}

export function statusActions(
  status: AppointmentStatus,
  role: MemberRole,
): AppointmentStatus[] {
  return TRANSITIONS[status].filter((target) => canTransitionStatus(status, target, role));
}

export function resolveServiceSnapshot(
  service: { priceCents: number; durationMinutes: number },
  override: {
    priceOverrideCents: number | null;
    durationOverrideMinutes: number | null;
    active: boolean;
  } | null,
): { priceCents: number; durationMinutes: number } {
  if (!override || !override.active) {
    return {
      priceCents: service.priceCents,
      durationMinutes: service.durationMinutes,
    };
  }
  return {
    priceCents: override.priceOverrideCents ?? service.priceCents,
    durationMinutes: override.durationOverrideMinutes ?? service.durationMinutes,
  };
}

export function endsAtFromStart(startsAtIso: string, durationMinutes: number): string {
  return new Date(new Date(startsAtIso).getTime() + durationMinutes * 60_000).toISOString();
}
