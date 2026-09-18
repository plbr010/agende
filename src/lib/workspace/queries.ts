import { createClient } from "@/lib/supabase/server";
import type { MemberRole, MemberStatus } from "@/lib/catalog/queries";
import type { Database } from "@/lib/supabase/database.types";
import { DEFAULT_TIMEZONE, resolveWorkspaceTimezone } from "@/lib/workspace/timezone";
import { parsePublicWorkspaceProfile, parseSeatUsage, type SeatUsage } from "@/lib/workspace/public";

export type WorkspaceSettingsRecord = {
  workspaceId: string;
  name: string;
  slug: string;
  businessPhone: string | null;
  businessEmail: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  instagram: string | null;
  logoPath: string | null;
  timezone: string;
};

export type PendingInvite = {
  id: string;
  email: string | null;
  role: MemberRole;
  expiresAt: string;
  createdAt: string;
};

export async function loadWorkspaceSettings(
  workspaceId: string,
  name: string,
  slug: string,
): Promise<WorkspaceSettingsRecord> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_settings")
    .select(
      "workspace_id, business_phone, business_email, description, address, city, state, postal_code, instagram, logo_path, timezone",
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return {
    workspaceId,
    name,
    slug,
    businessPhone: data?.business_phone ?? null,
    businessEmail: data?.business_email ?? null,
    description: data?.description ?? null,
    address: data?.address ?? null,
    city: data?.city ?? null,
    state: data?.state ?? null,
    postalCode: data?.postal_code ?? null,
    instagram: data?.instagram ?? null,
    logoPath: data?.logo_path ?? null,
    timezone: resolveWorkspaceTimezone(data?.timezone ?? DEFAULT_TIMEZONE),
  };
}

export async function loadSeatUsage(workspaceId: string): Promise<SeatUsage | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_workspace_seat_usage", {
    p_workspace_id: workspaceId,
  });
  return parseSeatUsage(data);
}

export async function loadPendingInvites(workspaceId: string): Promise<PendingInvite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_invites")
    .select("id, email, role, expires_at, created_at, accepted_at, revoked_at")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return (data ?? [])
    .filter((row) => new Date(row.expires_at).getTime() > Date.now())
    .map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
}

export async function loadPublicWorkspaceProfile(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_workspace_profile", { p_slug: slug });
  return parsePublicWorkspaceProfile(data);
}

export type SubscriptionDetail = {
  plan: Database["public"]["Enums"]["subscription_plan"];
  status: Database["public"]["Enums"]["subscription_status"];
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

export async function loadSubscriptionDetail(workspaceId: string): Promise<SubscriptionDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, trial_started_at, trial_ends_at, current_period_start, current_period_end")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data) {
    return null;
  }
  return {
    plan: data.plan,
    status: data.status,
    trialStartedAt: data.trial_started_at,
    trialEndsAt: data.trial_ends_at,
    currentPeriodStart: data.current_period_start,
    currentPeriodEnd: data.current_period_end,
  };
}

export function isManagerRole(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

export function canChangeMemberRole(status: MemberStatus, role: MemberRole): boolean {
  return role !== "owner" && status !== "removed";
}
