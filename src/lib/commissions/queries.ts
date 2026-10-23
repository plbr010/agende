import { z } from "zod";

export const commissionStatusSchema = z.enum(["pending", "released", "paid", "adjusted"]);

export const commissionStatusLabel: Record<z.infer<typeof commissionStatusSchema>, string> = {
  pending: "Aguardando",
  released: "Liberada",
  paid: "Paga",
  adjusted: "Ajustada",
};

const eventSchema = z.object({
  id: z.string().uuid(),
  event_type: z.string(),
  note: z.string().nullable(),
  current_cents: z.number().int(),
  released_cents: z.number().int(),
  paid_cents: z.number().int(),
  created_at: z.string(),
});

const paymentSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["payout", "recovery"]),
  amount_cents: z.number().int().positive(),
  paid_on: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
});

export const commissionsUiSchema = z.object({
  viewer: z.enum(["team", "own"]),
  entries: z.array(z.object({
    id: z.string().uuid(),
    appointment_id: z.string().uuid(),
    professional_member_id: z.string().uuid(),
    professional_name: z.string(),
    service_name: z.string(),
    client_name: z.string(),
    starts_at: z.string(),
    rate_bps: z.number().int(),
    eligible_cents: z.number().int(),
    original_cents: z.number().int(),
    current_cents: z.number().int(),
    released_cents: z.number().int(),
    paid_cents: z.number().int(),
    status: commissionStatusSchema,
    release_policy: z.enum(["on_completion", "on_receipt"]),
    manual_ceiling_cents: z.number().int().nullable(),
    created_at: z.string(),
    events: z.array(eventSchema),
    payments: z.array(paymentSchema),
  })),
});

export const commissionSettingsSchema = z.object({
  release_policy: z.enum(["on_completion", "on_receipt"]),
  rules: z.array(z.object({
    id: z.string().uuid(),
    professional_member_id: z.string().uuid(),
    professional_name: z.string(),
    service_id: z.string().uuid().nullable(),
    service_name: z.string().nullable(),
    rate_bps: z.number().int(),
    effective_from: z.string(),
  })),
});

const permissionRowSchema = z.object({
  key: z.string(),
  effective: z.boolean(),
  source: z.string(),
});

export const permissionEditorSchema = z.object({
  members: z.array(z.object({
    member_id: z.string().uuid(),
    full_name: z.string(),
    role: z.string(),
    editable: z.boolean(),
    permissions: z.array(permissionRowSchema),
  })),
});

export type CommissionsUi = z.infer<typeof commissionsUiSchema>;
export type CommissionSettings = z.infer<typeof commissionSettingsSchema>;
export type PermissionEditor = z.infer<typeof permissionEditorSchema>;

export const permissionLabels: Record<string, string> = {
  "appointments.view": "Ver a agenda",
  "appointments.create": "Marcar horário",
  "appointments.edit": "Editar atendimento",
  "appointments.reschedule": "Trocar horário",
  "appointments.cancel": "Cancelar ou marcar falta",
  "clients.view": "Ver clientes",
  "clients.manage": "Cadastrar e editar clientes",
  "inventory.view": "Ver estoque",
  "inventory.move": "Entrar e sair estoque",
  "inventory.manage": "Ajustar estoque",
  "finance.view": "Consultar o financeiro",
  "finance.receive": "Registrar recebimento",
  "finance.manage": "Gerenciar o financeiro",
  "reports.view": "Ver relatórios",
  "commissions.view_own": "Ver as próprias comissões",
  "commissions.manage_team": "Gerenciar comissões da equipe",
  "commissions.pay": "Registrar pagamento de comissão",
};

export function formatRate(rateBps: number): string {
  const whole = Math.trunc(rateBps / 100);
  const tenth = Math.trunc((rateBps % 100) / 10);
  return tenth === 0 ? `${whole}%` : `${whole},${tenth}%`;
}

export function percentToBps(input: string): number | null {
  const raw = input.trim().replace("%", "").replace(",", ".");
  if (!/^\d+(\.\d)?$/.test(raw)) return null;
  const [whole, fraction = "0"] = raw.split(".");
  const bps = Number(whole) * 100 + Number(fraction) * 10;
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) return null;
  return bps;
}
