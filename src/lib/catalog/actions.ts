"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireConfirmedSession } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import {
  parseClientForm,
  parseProfileForm,
  parseServiceForm,
} from "@/lib/validation/catalog";
import { parseReaisToCents } from "@/lib/validation/money";
import { canManageAllProfiles, canManageServices } from "@/lib/catalog/queries";

function fieldErrorsFromZod(error: { issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }> }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function mapCatalogError(message: string): string {
  if (message.includes("invalid_phone")) {
    return "Informe um telefone brasileiro válido, com DDD.";
  }
  if (message.includes("linked_user_id")) {
    return "A conta vinculada do cliente não pode ser alterada por aqui.";
  }
  if (message.includes("client_identity_immutable") || message.includes("service_identity_immutable")) {
    return "Não é permitido mover este registro para outro negócio.";
  }
  if (message.includes("booking_enabled_denied")) {
    return "Somente dono ou admin pode definir se a pessoa atende.";
  }
  if (message.includes("services_price") || message.includes("price_cents")) {
    return "O preço não pode ser negativo.";
  }
  if (message.includes("services_duration") || message.includes("duration_minutes")) {
    return "Informe uma duração entre 5 e 480 minutos.";
  }
  if (message.includes("professional_services_service_fk") || message.includes("professional_services_professional_fk")) {
    return "Profissional e serviço precisam pertencer ao mesmo negócio.";
  }
  if (message.includes("permission denied") || message.includes("42501") || message.includes("RLS")) {
    return "Você não tem permissão para esta ação.";
  }
  return "Não foi possível salvar. Tente novamente.";
}

async function requireWorkspace() {
  const session = await requireConfirmedSession("/app");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return { error: "Nenhum negócio encontrado." as const, session, workspace: null };
  }
  return { error: null, session, workspace };
}

export async function saveProfessionalProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseProfileForm(formData);
  if (!parsed.success) {
    return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }

  const isManager = canManageAllProfiles(workspace.role);
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id, user_id")
    .eq("id", parsed.data.memberId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!membership) {
    return { error: "Profissional não encontrado neste negócio." };
  }

  const isOwn = membership.user_id === session.user.id;
  if (!isManager && !isOwn) {
    return { error: "Você não pode editar este perfil." };
  }

  const patch: {
    display_name: string;
    bio: string | null;
    booking_enabled?: boolean;
  } = {
    display_name: parsed.data.displayName,
    bio: parsed.data.bio,
  };
  if (isManager && parsed.data.bookingEnabled !== undefined) {
    patch.booking_enabled = parsed.data.bookingEnabled;
  }

  const { error: updateError } = await supabase
    .from("professional_profiles")
    .update(patch)
    .eq("member_id", parsed.data.memberId)
    .eq("workspace_id", workspace.id);

  if (updateError) {
    return { error: mapCatalogError(updateError.message) };
  }

  revalidatePath("/app");
  revalidatePath("/app/equipe");
  return { success: "Perfil atualizado." };
}

export async function saveServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseServiceForm(formData);
  if (!parsed.success) {
    return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { error, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  if (!canManageServices(workspace.role)) {
    return { error: "Somente dono ou admin pode alterar o catálogo de serviços." };
  }

  const priceCents = parseReaisToCents(parsed.data.priceReais);
  if (priceCents === null) {
    return { error: "Informe um preço válido.", fieldErrors: { priceReais: "Preço inválido." } };
  }

  const supabase = await createClient();
  const payload = {
    workspace_id: workspace.id,
    name: parsed.data.name,
    description: parsed.data.description,
    duration_minutes: parsed.data.durationMinutes,
    price_cents: priceCents,
    active: parsed.data.active,
  };

  let serviceId = parsed.data.id;
  if (serviceId) {
    const { error: updateError } = await supabase
      .from("services")
      .update({
        name: payload.name,
        description: payload.description,
        duration_minutes: payload.duration_minutes,
        price_cents: payload.price_cents,
        active: payload.active,
      })
      .eq("id", serviceId)
      .eq("workspace_id", workspace.id);
    if (updateError) {
      return { error: mapCatalogError(updateError.message) };
    }
  } else {
    const { data, error: insertError } = await supabase
      .from("services")
      .insert(payload)
      .select("id")
      .single();
    if (insertError || !data) {
      return { error: mapCatalogError(insertError?.message ?? "") };
    }
    serviceId = data.id;
  }

  const { data: existing } = await supabase
    .from("professional_services")
    .select("id, professional_member_id, active")
    .eq("workspace_id", workspace.id)
    .eq("service_id", serviceId);

  const wanted = new Set(parsed.data.professionalMemberIds);
  const seen = new Set<string>();

  for (const row of existing ?? []) {
    seen.add(row.professional_member_id);
    const shouldBeActive = wanted.has(row.professional_member_id);
    if (row.active !== shouldBeActive) {
      const { error: linkError } = await supabase
        .from("professional_services")
        .update({ active: shouldBeActive })
        .eq("id", row.id)
        .eq("workspace_id", workspace.id);
      if (linkError) {
        return { error: mapCatalogError(linkError.message) };
      }
    }
  }

  for (const memberId of wanted) {
    if (seen.has(memberId)) continue;
    const { error: linkError } = await supabase.from("professional_services").insert({
      workspace_id: workspace.id,
      professional_member_id: memberId,
      service_id: serviceId,
      active: true,
    });
    if (linkError) {
      return { error: mapCatalogError(linkError.message) };
    }
  }

  revalidatePath("/app");
  revalidatePath("/app/servicos");
  revalidatePath("/app/equipe");
  return { success: parsed.data.id ? "Serviço atualizado." : "Serviço cadastrado." };
}

export async function archiveServiceAction(formData: FormData): Promise<ActionState> {
  const { error, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  if (!canManageServices(workspace.role)) {
    return { error: "Somente dono ou admin pode arquivar serviços." };
  }
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("services")
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (updateError) {
    return { error: mapCatalogError(updateError.message) };
  }
  revalidatePath("/app");
  revalidatePath("/app/servicos");
  return { success: "Serviço arquivado." };
}

export async function toggleOwnServiceAction(formData: FormData): Promise<ActionState> {
  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const serviceId = String(formData.get("serviceId") ?? "");
  const enabled = formData.get("enabled") === "true";
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("user_id", session.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) {
    return { error: "Você não faz parte desta equipe." };
  }

  const { data: existing } = await supabase
    .from("professional_services")
    .select("id, active")
    .eq("workspace_id", workspace.id)
    .eq("service_id", serviceId)
    .eq("professional_member_id", membership.id)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await supabase
      .from("professional_services")
      .update({ active: enabled })
      .eq("id", existing.id)
      .eq("workspace_id", workspace.id);
    if (updateError) {
      return { error: mapCatalogError(updateError.message) };
    }
  } else if (enabled) {
    const { error: insertError } = await supabase.from("professional_services").insert({
      workspace_id: workspace.id,
      professional_member_id: membership.id,
      service_id: serviceId,
      active: true,
    });
    if (insertError) {
      return { error: mapCatalogError(insertError.message) };
    }
  }

  revalidatePath("/app");
  revalidatePath("/app/servicos");
  revalidatePath("/app/equipe");
  return { success: "Associação atualizada." };
}

export async function saveClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { error, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }

  const supabase = await createClient();
  const payload = {
    workspace_id: workspace.id,
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    birth_date: parsed.data.birthDate,
    notes: parsed.data.notes,
  };

  if (parsed.data.id) {
    const { error: updateError } = await supabase
      .from("workspace_clients")
      .update({
        full_name: payload.full_name,
        email: payload.email,
        phone: payload.phone,
        birth_date: payload.birth_date,
        notes: payload.notes,
      })
      .eq("id", parsed.data.id)
      .eq("workspace_id", workspace.id);
    if (updateError) {
      return { error: mapCatalogError(updateError.message) };
    }
    revalidatePath("/app");
    revalidatePath("/app/clientes");
    return { success: "Cliente atualizado." };
  }

  const { error: insertError } = await supabase.from("workspace_clients").insert(payload);
  if (insertError) {
    return { error: mapCatalogError(insertError.message) };
  }
  revalidatePath("/app");
  revalidatePath("/app/clientes");
  return { success: "Cliente cadastrado." };
}

export async function archiveClientAction(formData: FormData): Promise<ActionState> {
  const { error, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("workspace_clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (updateError) {
    return { error: mapCatalogError(updateError.message) };
  }
  revalidatePath("/app");
  revalidatePath("/app/clientes");
  return { success: "Cliente arquivado." };
}
