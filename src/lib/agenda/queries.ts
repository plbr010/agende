import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/catalog/queries";
import type { AppointmentStatus } from "@/lib/agenda/status";
import {
  formatDateInProductTz,
  formatTimeInProductTz,
  startOfLocalDayUtc,
  startOfNextLocalDayUtc,
} from "@/lib/time/timezone";

export type AgendaAppointment = {
  id: string;
  workspaceId: string;
  clientId: string;
  clientName: string;
  professionalMemberId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  priceCents: number;
  durationMinutes: number;
  notes: string | null;
  localDate: string;
  localStart: string;
  localEnd: string;
};

export type WorkingHourRow = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  active: boolean;
};

export type BreakRow = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  label: string | null;
  active: boolean;
};

export type TimeBlockRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  localDate: string;
  localStart: string;
  localEnd: string;
};

export function canManageJornada(role: MemberRole, isOwn: boolean): boolean {
  return role === "owner" || role === "admin" || (role === "professional" && isOwn);
}

export function canManageTimeBlocks(role: MemberRole, isOwn: boolean): boolean {
  return role === "owner" || role === "admin" || role === "receptionist" || (role === "professional" && isOwn);
}

export function canWriteAppointment(role: MemberRole, isOwnProfessional: boolean): boolean {
  return role === "owner" || role === "admin" || role === "receptionist" || (role === "professional" && isOwnProfessional);
}

function trimTime(value: string): string {
  return value.slice(0, 5);
}

export async function loadAgendaRange(
  workspaceId: string,
  fromDate: string,
  toDateExclusive: string,
  professionalMemberId?: string,
): Promise<AgendaAppointment[]> {
  const supabase = await createClient();
  const fromIso = startOfLocalDayUtc(fromDate).toISOString();
  const toIso = startOfLocalDayUtc(toDateExclusive).toISOString();

  let request = supabase
    .from("appointments")
    .select(
      "id, workspace_id, client_id, professional_member_id, service_id, starts_at, ends_at, status, price_cents, duration_minutes, notes",
    )
    .eq("workspace_id", workspaceId)
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at", { ascending: true });

  if (professionalMemberId) {
    request = request.eq("professional_member_id", professionalMemberId);
  }

  const { data: rows } = await request;
  const appointments = rows ?? [];
  if (appointments.length === 0) {
    return [];
  }

  const clientIds = [...new Set(appointments.map((row) => row.client_id))];
  const memberIds = [...new Set(appointments.map((row) => row.professional_member_id))];
  const serviceIds = [...new Set(appointments.map((row) => row.service_id))];

  const [{ data: clients }, { data: profiles }, { data: services }] = await Promise.all([
    supabase.from("workspace_clients").select("id, full_name").eq("workspace_id", workspaceId).in("id", clientIds),
    supabase
      .from("professional_profiles")
      .select("member_id, display_name")
      .eq("workspace_id", workspaceId)
      .in("member_id", memberIds),
    supabase.from("services").select("id, name").eq("workspace_id", workspaceId).in("id", serviceIds),
  ]);

  const clientById = new Map((clients ?? []).map((row) => [row.id, row.full_name]));
  const professionalById = new Map((profiles ?? []).map((row) => [row.member_id, row.display_name]));
  const serviceById = new Map((services ?? []).map((row) => [row.id, row.name]));

  return appointments.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    clientId: row.client_id,
    clientName: clientById.get(row.client_id) ?? "Cliente",
    professionalMemberId: row.professional_member_id,
    professionalName: professionalById.get(row.professional_member_id) ?? "Profissional",
    serviceId: row.service_id,
    serviceName: serviceById.get(row.service_id) ?? "Serviço",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status as AppointmentStatus,
    priceCents: row.price_cents,
    durationMinutes: row.duration_minutes,
    notes: row.notes,
    localDate: formatDateInProductTz(row.starts_at),
    localStart: formatTimeInProductTz(row.starts_at),
    localEnd: formatTimeInProductTz(row.ends_at),
  }));
}

export async function loadWorkingHours(workspaceId: string, memberId: string): Promise<WorkingHourRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professional_working_hours")
    .select("id, weekday, start_time, end_time, active")
    .eq("workspace_id", workspaceId)
    .eq("professional_member_id", memberId)
    .order("weekday")
    .order("start_time");

  return (data ?? []).map((row) => ({
    id: row.id,
    weekday: row.weekday,
    startTime: trimTime(row.start_time),
    endTime: trimTime(row.end_time),
    active: row.active,
  }));
}

export async function loadBreaks(workspaceId: string, memberId: string): Promise<BreakRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professional_breaks")
    .select("id, weekday, start_time, end_time, label, active")
    .eq("workspace_id", workspaceId)
    .eq("professional_member_id", memberId)
    .order("weekday")
    .order("start_time");

  return (data ?? []).map((row) => ({
    id: row.id,
    weekday: row.weekday,
    startTime: trimTime(row.start_time),
    endTime: trimTime(row.end_time),
    label: row.label,
    active: row.active,
  }));
}

export async function loadTimeBlocks(workspaceId: string, memberId: string): Promise<TimeBlockRow[]> {
  const supabase = await createClient();
  const fromIso = startOfLocalDayUtc(formatDateInProductTz(new Date())).toISOString();
  const { data } = await supabase
    .from("professional_time_blocks")
    .select("id, starts_at, ends_at, reason")
    .eq("workspace_id", workspaceId)
    .eq("professional_member_id", memberId)
    .gte("ends_at", fromIso)
    .order("starts_at")
    .limit(50);

  return (data ?? []).map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
    localDate: formatDateInProductTz(row.starts_at),
    localStart: formatTimeInProductTz(row.starts_at),
    localEnd: formatTimeInProductTz(row.ends_at),
  }));
}

export async function loadAvailableSlots(
  workspaceId: string,
  professionalMemberId: string,
  serviceId: string,
  localDate: string,
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_available_slots", {
    p_workspace_id: workspaceId,
    p_professional_member_id: professionalMemberId,
    p_service_id: serviceId,
    p_local_date: localDate,
  });
  if (error) {
    return [];
  }
  return (data ?? []).map((row) => row.starts_at);
}

export async function loadCurrentMemberId(workspaceId: string, userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data?.id ?? null;
}

export { startOfNextLocalDayUtc };
