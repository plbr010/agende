import type { Database } from "@/lib/supabase/database.types";

export type MemberRole = Database["public"]["Enums"]["member_role"];
export type MemberStatus = Database["public"]["Enums"]["member_status"];
export type SubscriptionPlan = Database["public"]["Enums"]["subscription_plan"];
export type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Dono",
  admin: "Admin",
  professional: "Profissional",
  receptionist: "Recepção",
};

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  invited: "Convidado",
  active: "Ativo",
  inactive: "Inativo",
  removed: "Removido",
};

export const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  solo: "Solo",
  equipe: "Equipe",
  salao: "Salão",
};

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "Em trial",
  active: "Ativa",
  past_due: "Pagamento pendente",
  expired: "Expirada",
  canceled: "Cancelada",
};

export const INVITE_ROLES = ["admin", "professional", "receptionist"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export const BR_STATES = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
] as const;

export const selectClassName =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";
