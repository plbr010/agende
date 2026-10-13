import type { AppointmentStatus } from "@/lib/agenda/status";

export const STATUS_CHIP_CLASS: Record<AppointmentStatus, string> = {
  scheduled: "bg-[var(--status-scheduled-bg)] text-[var(--status-scheduled-fg)]",
  confirmed: "bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-fg)]",
  in_progress: "bg-[var(--status-progress-bg)] text-[var(--status-progress-fg)]",
  completed: "bg-[var(--status-done-bg)] text-[var(--status-done-fg)]",
  cancelled: "bg-[var(--status-muted-bg)] text-[var(--status-muted-fg)]",
  no_show: "bg-[var(--status-muted-bg)] text-[var(--status-muted-fg)]",
};
