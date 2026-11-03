import { PLAN_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/lib/workspace/labels";
import { formatCentsToReais } from "@/lib/validation/money";

export const ADMIN_PLAN_OPTIONS = [
  { value: "solo", label: PLAN_LABEL.solo },
  { value: "equipe", label: PLAN_LABEL.equipe },
  { value: "salao", label: PLAN_LABEL.salao },
] as const;

export const ADMIN_SUBSCRIPTION_STATUS_OPTIONS = [
  { value: "trialing", label: SUBSCRIPTION_STATUS_LABEL.trialing },
  { value: "active", label: SUBSCRIPTION_STATUS_LABEL.active },
  { value: "past_due", label: SUBSCRIPTION_STATUS_LABEL.past_due },
  { value: "expired", label: SUBSCRIPTION_STATUS_LABEL.expired },
  { value: "canceled", label: SUBSCRIPTION_STATUS_LABEL.canceled },
] as const;

export const ADMIN_BILLING_KIND_LABEL = {
  paid: "Aprovado",
  pending: "Pendente",
  failed: "Recusado",
  canceled: "Cancelado",
} as const;

export const ADMIN_APPOINTMENT_STATUS_LABEL = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Realizado",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
} as const;

export function formatPlan(plan: string | null | undefined): string {
  if (!plan) return "—";
  return PLAN_LABEL[plan as keyof typeof PLAN_LABEL] ?? plan;
}

export function formatSubscriptionStatus(status: string | null | undefined): string {
  if (!status) return "Sem assinatura";
  return SUBSCRIPTION_STATUS_LABEL[status as keyof typeof SUBSCRIPTION_STATUS_LABEL] ?? status;
}

export function formatPercent(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(rate);
}

export function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return formatCentsToReais(cents);
}

export function formatCount(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

export function billingKindLabel(kind: string | null | undefined): string {
  if (!kind) return "—";
  return ADMIN_BILLING_KIND_LABEL[kind as keyof typeof ADMIN_BILLING_KIND_LABEL] ?? kind;
}

export function appointmentStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return ADMIN_APPOINTMENT_STATUS_LABEL[status as keyof typeof ADMIN_APPOINTMENT_STATUS_LABEL] ?? status;
}

export function adminActionLabel(action: string): string {
  const labels: Record<string, string> = {
    "admin.grant": "Concedeu acesso master",
    "account.suspend": "Suspendeu conta",
    "account.reactivate": "Reativou conta",
  };
  return labels[action] ?? action;
}
