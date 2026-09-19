import { createClient } from "@/lib/supabase/server";
import { publicLogoUrl } from "@/lib/workspace/public";
import { DEFAULT_TIMEZONE, resolveWorkspaceTimezone } from "@/lib/workspace/timezone";

export type PublicBookingService = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  minPriceCents: number;
  maxPriceCents: number;
};

export type PublicBookingOffering = {
  serviceId: string;
  priceCents: number;
  durationMinutes: number;
};

export type PublicBookingProfessional = {
  id: string;
  displayName: string;
  bio: string | null;
  serviceIds: string[];
  offerings: PublicBookingOffering[];
};

export type PublicBookingCatalog = {
  name: string;
  slug: string;
  timezone: string;
  logoUrl: string | null;
  horizonDays: number;
  minLeadMinutes: number;
  services: PublicBookingService[];
  professionals: PublicBookingProfessional[];
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parsePublicBookingCatalog(raw: unknown): PublicBookingCatalog | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const data = raw as Record<string, unknown>;
  const name = asString(data.name);
  const slug = asString(data.slug);
  if (!name || !slug) {
    return null;
  }
  const services = Array.isArray(data.services)
    ? data.services.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const id = asString(row.id);
        const serviceName = asString(row.name);
        if (!id || !serviceName) return [];
        return [
          {
            id,
            name: serviceName,
            description: asString(row.description),
            durationMinutes: asNumber(row.duration_minutes),
            priceCents: asNumber(row.price_cents),
            minPriceCents: asNumber(row.min_price_cents, asNumber(row.price_cents)),
            maxPriceCents: asNumber(row.max_price_cents, asNumber(row.price_cents)),
          },
        ];
      })
    : [];
  const professionals = Array.isArray(data.professionals)
    ? data.professionals.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const id = asString(row.id);
        const displayName = asString(row.display_name);
        if (!id || !displayName) return [];
        return [
          {
            id,
            displayName,
            bio: asString(row.bio),
            serviceIds: Array.isArray(row.service_ids)
              ? row.service_ids.filter((value): value is string => typeof value === "string")
              : [],
            offerings: Array.isArray(row.offerings)
              ? row.offerings.flatMap((offering) => {
                  if (!offering || typeof offering !== "object") return [];
                  const item = offering as Record<string, unknown>;
                  const serviceId = asString(item.service_id);
                  if (!serviceId) return [];
                  return [
                    {
                      serviceId,
                      priceCents: asNumber(item.price_cents),
                      durationMinutes: asNumber(item.duration_minutes),
                    },
                  ];
                })
              : [],
          },
        ];
      })
    : [];

  return {
    name,
    slug,
    timezone: resolveWorkspaceTimezone(asString(data.timezone) ?? DEFAULT_TIMEZONE),
    logoUrl: publicLogoUrl(asString(data.logo_path)),
    horizonDays: asNumber(data.horizon_days, 90),
    minLeadMinutes: asNumber(data.min_lead_minutes, 30),
    services,
    professionals,
  };
}

export async function loadPublicBookingCatalog(slug: string): Promise<PublicBookingCatalog | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_public_booking_catalog", { p_slug: slug });
  if (error) {
    return null;
  }
  return parsePublicBookingCatalog(data);
}

export async function loadPublicAvailableSlots(input: {
  slug: string;
  serviceId: string;
  professionalMemberId: string | null;
  localDate: string;
}): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_public_available_slots", {
    p_slug: input.slug,
    p_service_id: input.serviceId,
    p_professional_member_id: input.professionalMemberId,
    p_local_date: input.localDate,
  });
  if (error || !data) {
    return [];
  }
  return data
    .map((row) => (typeof row.starts_at === "string" ? row.starts_at : null))
    .filter((value): value is string => Boolean(value));
}

export type MyAppointment = {
  id: string;
  workspaceName: string;
  slug: string;
  serviceName: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  priceCents: number;
  status: string;
  timezone: string;
  customerNote: string | null;
  businessPhone: string | null;
};

export function parseMyAppointments(raw: unknown): MyAppointment[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = asString(row.id);
    const workspaceName = asString(row.workspace_name);
    const slug = asString(row.slug);
    const serviceName = asString(row.service_name);
    const professionalName = asString(row.professional_name);
    const startsAt = asString(row.starts_at);
    const endsAt = asString(row.ends_at);
    if (!id || !workspaceName || !slug || !serviceName || !professionalName || !startsAt || !endsAt) {
      return [];
    }
    return [
      {
        id,
        workspaceName,
        slug,
        serviceName,
        professionalName,
        startsAt,
        endsAt,
        durationMinutes: asNumber(row.duration_minutes),
        priceCents: asNumber(row.price_cents),
        status: asString(row.status) ?? "scheduled",
        timezone: resolveWorkspaceTimezone(asString(row.timezone) ?? DEFAULT_TIMEZONE),
        customerNote: asString(row.customer_note),
        businessPhone: asString(row.business_phone),
      },
    ];
  });
}

export async function loadMyAppointments(): Promise<MyAppointment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_appointments");
  if (error) {
    return [];
  }
  return parseMyAppointments(data);
}

export type PublicBookingConfirmation = {
  appointmentId: string;
  workspaceName: string;
  slug: string;
  serviceName: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  priceCents: number;
  timezone: string;
  status: string;
  businessPhone: string | null;
  guest: boolean;
};

export function parsePublicBookingConfirmation(raw: unknown): PublicBookingConfirmation | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const appointmentId = asString(row.appointment_id);
  const workspaceName = asString(row.workspace_name);
  const slug = asString(row.slug);
  const serviceName = asString(row.service_name);
  const professionalName = asString(row.professional_name);
  const startsAt = asString(row.starts_at);
  const endsAt = asString(row.ends_at);
  if (!appointmentId || !workspaceName || !slug || !serviceName || !professionalName || !startsAt || !endsAt) {
    return null;
  }
  return {
    appointmentId,
    workspaceName,
    slug,
    serviceName,
    professionalName,
    startsAt,
    endsAt,
    durationMinutes: asNumber(row.duration_minutes),
    priceCents: asNumber(row.price_cents),
    timezone: resolveWorkspaceTimezone(asString(row.timezone) ?? DEFAULT_TIMEZONE),
    status: asString(row.status) ?? "scheduled",
    businessPhone: asString(row.business_phone),
    guest: row.guest === true,
  };
}
