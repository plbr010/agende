import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { normalizePhone } from "@/lib/validation/phone";

export type MemberRole = Database["public"]["Enums"]["member_role"];
export type MemberStatus = Database["public"]["Enums"]["member_status"];

export type TeamMember = {
  memberId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  fullName: string;
  email: string;
  displayName: string | null;
  bio: string | null;
  bookingEnabled: boolean | null;
  hasProfessionalProfile: boolean;
  serviceCount: number;
};

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  active: boolean;
  archivedAt: string | null;
  professionalMemberIds: string[];
};

export type ClientRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  notes: string | null;
  archivedAt: string | null;
};

export function canManageServices(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

export function canManageAllProfiles(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

export function canEditClients(role: MemberRole): boolean {
  return role === "owner" || role === "admin" || role === "professional" || role === "receptionist";
}

function sanitizeSearch(query?: string): string | null {
  if (!query) {
    return null;
  }
  const cleaned = query.replace(/[%_(),\\]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length >= 2 ? cleaned : null;
}

export async function loadTeam(workspaceId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("id, user_id, role, status")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  const rows = members ?? [];
  const userIds = rows.map((row) => row.user_id);
  const memberIds = rows.map((row) => row.id);

  const peopleQuery = userIds.length
    ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
    : Promise.resolve({ data: [] as { user_id: string; full_name: string; email: string }[] });
  const linksQuery = memberIds.length
    ? supabase
        .from("professional_services")
        .select("professional_member_id")
        .eq("workspace_id", workspaceId)
        .eq("active", true)
        .in("professional_member_id", memberIds)
    : Promise.resolve({ data: [] as { professional_member_id: string }[] });

  const [{ data: people }, { data: profiles }, { data: links }] = await Promise.all([
    peopleQuery,
    supabase
      .from("professional_profiles")
      .select("member_id, display_name, bio, booking_enabled")
      .eq("workspace_id", workspaceId),
    linksQuery,
  ]);

  const personByUser = new Map((people ?? []).map((row) => [row.user_id, row]));

  const profileByMember = new Map((profiles ?? []).map((row) => [row.member_id, row]));
  const counts = new Map<string, number>();
  for (const link of links ?? []) {
    counts.set(link.professional_member_id, (counts.get(link.professional_member_id) ?? 0) + 1);
  }

  return rows.flatMap((row) => {
    const person = personByUser.get(row.user_id);
    if (!person) {
      return [];
    }
    const profile = profileByMember.get(row.id);
    return [
      {
        memberId: row.id,
        userId: row.user_id,
        role: row.role,
        status: row.status,
        fullName: person.full_name,
        email: person.email,
        displayName: profile?.display_name ?? null,
        bio: profile?.bio ?? null,
        bookingEnabled: profile?.booking_enabled ?? null,
        hasProfessionalProfile: Boolean(profile),
        serviceCount: counts.get(row.id) ?? 0,
      },
    ];
  });
}

export async function loadServices(workspaceId: string, query?: string): Promise<ServiceRow[]> {
  const supabase = await createClient();
  let request = supabase
    .from("services")
    .select("id, name, description, duration_minutes, price_cents, active, archived_at")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("name");

  const search = sanitizeSearch(query);
  if (search) {
    request = request.ilike("name", `%${search}%`);
  }

  const [{ data: services }, { data: links }] = await Promise.all([
    request,
    supabase
      .from("professional_services")
      .select("service_id, professional_member_id, active")
      .eq("workspace_id", workspaceId)
      .eq("active", true),
  ]);

  const byService = new Map<string, string[]>();
  for (const link of links ?? []) {
    const current = byService.get(link.service_id) ?? [];
    current.push(link.professional_member_id);
    byService.set(link.service_id, current);
  }

  return (services ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    active: row.active,
    archivedAt: row.archived_at,
    professionalMemberIds: byService.get(row.id) ?? [],
  }));
}

export async function loadClients(workspaceId: string, query?: string): Promise<ClientRow[]> {
  const supabase = await createClient();
  const request = supabase
    .from("workspace_clients")
    .select("id, full_name, email, phone, birth_date, notes, archived_at")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("full_name");

  const search = sanitizeSearch(query);
  const { data } = await request;
  const phone = search ? normalizePhone(search) : null;
  const needle = search?.toLowerCase() ?? "";

  return (data ?? [])
    .filter((row) => {
      if (!needle) {
        return true;
      }
      return (
        row.full_name.toLowerCase().includes(needle) ||
        (row.email != null && row.email.toLowerCase().includes(needle)) ||
        (row.phone != null && row.phone.toLowerCase().includes(needle)) ||
        (phone != null && row.phone === phone)
      );
    })
    .map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    birthDate: row.birth_date,
    notes: row.notes,
    archivedAt: row.archived_at,
  }));
}
