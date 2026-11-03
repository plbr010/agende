import { Badge } from "@/components/ui/badge";
import {
  ADMIN_APPOINTMENT_STATUS_LABEL,
  ADMIN_BILLING_KIND_LABEL,
  formatPlan,
  formatSubscriptionStatus,
} from "@/lib/admin/format";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  active: "bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-fg)]",
  trialing: "bg-[var(--status-scheduled-bg)] text-[var(--status-scheduled-fg)]",
  past_due: "bg-[var(--status-progress-bg)] text-[var(--status-progress-fg)]",
  expired: "bg-muted text-muted-foreground",
  canceled: "bg-[var(--status-muted-bg)] text-[var(--status-muted-fg)]",
  held: "bg-[var(--status-muted-bg)] text-[var(--status-muted-fg)]",
  paid: "bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-fg)]",
  pending: "bg-[var(--status-progress-bg)] text-[var(--status-progress-fg)]",
  failed: "bg-[var(--status-muted-bg)] text-[var(--status-muted-fg)]",
  completed: "bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-fg)]",
  cancelled: "bg-[var(--status-muted-bg)] text-[var(--status-muted-fg)]",
  confirmed: "bg-[var(--status-scheduled-bg)] text-[var(--status-scheduled-fg)]",
  scheduled: "bg-metric-ivory text-wine-deep",
};

export function StatusBadge({
  value,
  kind = "status",
}: {
  value: string | null | undefined;
  kind?: "status" | "plan" | "billing" | "appointment" | "hold";
}) {
  if (kind === "hold") {
    return (
      <Badge variant="outline" className={cn("border-0", value ? TONE.held : TONE.active)}>
        {value ? "Suspensa" : "Ativa"}
      </Badge>
    );
  }
  if (!value) {
    return <Badge variant="outline">—</Badge>;
  }
  const label =
    kind === "plan"
      ? formatPlan(value)
      : kind === "billing"
        ? (ADMIN_BILLING_KIND_LABEL[value as keyof typeof ADMIN_BILLING_KIND_LABEL] ?? value)
        : kind === "appointment"
          ? (ADMIN_APPOINTMENT_STATUS_LABEL[value as keyof typeof ADMIN_APPOINTMENT_STATUS_LABEL] ?? value)
          : formatSubscriptionStatus(value);
  return (
    <Badge variant="outline" className={cn("border-0", TONE[value] ?? "bg-muted text-muted-foreground")}>
      {label}
    </Badge>
  );
}
