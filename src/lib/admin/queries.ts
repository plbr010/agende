import "server-only";
import { requireReadyPlatformAdmin } from "./guard";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminErrorMessage } from "@/lib/admin/errors";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/params";

const pageSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  counts: z.record(z.string(), z.unknown()).optional(),
});

const metric = z.coerce.number();
const dashboardSchema = z.object({
  metrics: z.object({
    professionals: metric,
    workspaces: metric,
    clients: metric,
    workspace_clients: metric,
    users: metric,
    active_users: metric,
    signups_today: metric,
    signups_7d: metric,
    signups_30d: metric,
    subscriptions_active: metric,
    subscriptions_trialing: metric,
    subscriptions_canceled: metric,
    subscriptions_past_due: metric,
    subscriptions_expired: metric.optional(),
    mrr_cents: metric,
    revenue_cents: metric,
    trial_conversion_rate: z.number().nullable(),
    churn_rate_30d: z.number().nullable(),
    appointments: metric,
    plans: z.array(z.object({
      code: z.string(),
      name: z.string(),
      monthly_price_cents: z.number(),
      annual_price_cents: z.number().nullable(),
      max_professionals: z.number(),
    })),
  }),
  growth: z.array(z.object({ date: z.string(), count: metric })),
  subscription_growth: z.array(z.object({ date: z.string(), count: metric })),
  revenue: z.array(z.object({ date: z.string(), cents: metric })),
});

export type AdminDashboard = z.infer<typeof dashboardSchema>;
export type AdminPage<T = Record<string, unknown>> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  counts?: Record<string, unknown>;
};

type RpcClient = Awaited<ReturnType<typeof createClient>>;
type RpcName = Parameters<RpcClient["rpc"]>[0];

async function adminRpc<T>(
  name: RpcName,
  args: Parameters<RpcClient["rpc"]>[1] | undefined,
  schema: z.ZodType<T>,
  fallback: string,
): Promise<T> {
  await requireReadyPlatformAdmin("/admin");
  const supabase = await createClient();
  const result = args === undefined
    ? await supabase.rpc(name)
    : await supabase.rpc(name, args);
  if (result.error) {
    throw new Error(adminErrorMessage(result.error, fallback));
  }
  const parsed = schema.safeParse(result.data);
  if (!parsed.success) {
    throw new Error(fallback);
  }
  return parsed.data;
}

function pageArgs(page: number) {
  return { p_limit: ADMIN_PAGE_SIZE, p_offset: (page - 1) * ADMIN_PAGE_SIZE };
}

export async function loadAdminDashboard(): Promise<AdminDashboard> {
  return adminRpc("admin_dashboard_overview", undefined, dashboardSchema, "Não foi possível carregar o painel.");
}

const salonOverviewSchema = pageSchema.extend({
  counts: z.object({ total: metric, trial: metric, paid: metric, delinquent: metric, unverified: metric }),
  as_of: z.string().datetime({ offset: true }),
});
export async function loadAdminSalonOverview(input: {
  query?: string | null; status?: string | null; page?: number; workspaceId?: string;
}) {
  return adminRpc("admin_salon_overview", {
    p_query: input.query ?? null, p_status: input.status ?? null,
    p_workspace_id: input.workspaceId ?? null, ...pageArgs(input.page ?? 1),
  }, salonOverviewSchema, "Não foi possível carregar os salões.");
}

export async function loadAdminProfessionals(input: {
  query: string | null;
  plan: string | null;
  status: string | null;
  page: number;
}): Promise<AdminPage> {
  return adminRpc("admin_list_professionals", {
    p_query: input.query,
    p_plan: input.plan,
    p_status: input.status,
    ...pageArgs(input.page),
  }, pageSchema, "Não foi possível carregar os profissionais.");
}

export async function loadAdminWorkspaces(input: {
  query: string | null;
  plan: string | null;
  status: string | null;
  page: number;
}): Promise<AdminPage> {
  return adminRpc("admin_list_workspaces", {
    p_query: input.query,
    p_plan: input.plan,
    p_status: input.status,
    ...pageArgs(input.page),
  }, pageSchema, "Não foi possível carregar os estabelecimentos.");
}

export async function loadAdminClients(input: {
  query: string | null;
  status: string | null;
  page: number;
}): Promise<AdminPage> {
  return adminRpc("admin_list_clients", {
    p_query: input.query,
    p_status: input.status,
    ...pageArgs(input.page),
  }, pageSchema, "Não foi possível carregar os clientes.");
}

export async function loadAdminSubscriptions(input: {
  query: string | null;
  plan: string | null;
  status: string | null;
  page: number;
}): Promise<AdminPage> {
  return adminRpc("admin_list_subscriptions", {
    p_query: input.query,
    p_plan: input.plan,
    p_status: input.status,
    ...pageArgs(input.page),
  }, pageSchema, "Não foi possível carregar as assinaturas.");
}

export async function loadAdminBillingEvents(input: {
  query: string | null;
  kind: string | null;
  page: number;
}): Promise<AdminPage> {
  return adminRpc("admin_list_billing_events", {
    p_query: input.query,
    p_kind: input.kind,
    ...pageArgs(input.page),
  }, pageSchema, "Não foi possível carregar as cobranças.");
}

export async function loadAdminAppointments(input: {
  query: string | null;
  status: string | null;
  workspaceId: string | null;
  from: string | null;
  to: string | null;
  page: number;
}): Promise<AdminPage> {
  return adminRpc("admin_list_appointments", {
    p_query: input.query,
    p_status: input.status,
    p_workspace_id: input.workspaceId,
    p_from: input.from,
    p_to: input.to,
    ...pageArgs(input.page),
  }, pageSchema, "Não foi possível carregar os agendamentos.");
}

export async function loadAdminUsers(input: {
  query: string | null;
  intent: string | null;
  status: string | null;
  page: number;
}): Promise<AdminPage> {
  return adminRpc("admin_list_users", {
    p_query: input.query,
    p_intent: input.intent,
    p_status: input.status,
    ...pageArgs(input.page),
  }, pageSchema, "Não foi possível carregar os usuários.");
}

export async function loadAdminAudit(input: { query: string | null; page: number }): Promise<AdminPage> {
  return adminRpc("admin_list_audit_events", {
    p_query: input.query,
    ...pageArgs(input.page),
  }, pageSchema, "Não foi possível carregar o histórico administrativo.");
}

export async function loadAdminProfessional(userId: string): Promise<Record<string, unknown>> {
  return adminRpc("admin_get_professional", { p_user_id: userId }, z.record(z.string(), z.unknown()), "Não encontramos esse profissional.");
}

export async function loadAdminWorkspace(workspaceId: string): Promise<Record<string, unknown>> {
  return adminRpc("admin_get_workspace", { p_workspace_id: workspaceId }, z.record(z.string(), z.unknown()), "Não encontramos esse estabelecimento.");
}

export async function loadAdminClient(userId: string): Promise<Record<string, unknown>> {
  return adminRpc("admin_get_client", { p_user_id: userId }, z.record(z.string(), z.unknown()), "Não encontramos esse cliente.");
}

export async function loadAdminSupportOverview(): Promise<Record<string, unknown>> {
  return adminRpc("admin_support_overview", undefined, z.record(z.string(), z.unknown()), "Não foi possível carregar o suporte.");
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asBoolean(value: unknown): boolean {
  return value === true;
}

export function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}
