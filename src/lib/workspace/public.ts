import { getSupabaseUrl } from "@/lib/supabase/env";

export type PublicService = {
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  min_price_cents: number;
  max_price_cents: number;
};

export type PublicProfessional = {
  display_name: string;
  bio: string | null;
  services: string[];
};

export type PublicWorkspaceProfile = {
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  state: string | null;
  instagram: string | null;
  logo_path: string | null;
  logoUrl: string | null;
  services: PublicService[];
  professionals: PublicProfessional[];
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function publicLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) {
    return null;
  }
  return `${getSupabaseUrl()}/storage/v1/object/public/workspace-logos/${logoPath}`;
}

export function parsePublicWorkspaceProfile(raw: unknown): PublicWorkspaceProfile | null {
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
        const serviceName = asString(row.name);
        if (!serviceName) return [];
        return [
          {
            name: serviceName,
            description: asString(row.description),
            duration_minutes: asNumber(row.duration_minutes),
            price_cents: asNumber(row.price_cents),
            min_price_cents: asNumber(row.min_price_cents, asNumber(row.price_cents)),
            max_price_cents: asNumber(row.max_price_cents, asNumber(row.price_cents)),
          },
        ];
      })
    : [];

  const professionals = Array.isArray(data.professionals)
    ? data.professionals.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const displayName = asString(row.display_name);
        if (!displayName) return [];
        return [
          {
            display_name: displayName,
            bio: asString(row.bio),
            services: Array.isArray(row.services)
              ? row.services.filter((value): value is string => typeof value === "string")
              : [],
          },
        ];
      })
    : [];

  const logoPath = asString(data.logo_path);
  return {
    name,
    slug,
    description: asString(data.description),
    city: asString(data.city),
    state: asString(data.state),
    instagram: asString(data.instagram),
    logo_path: logoPath,
    logoUrl: publicLogoUrl(logoPath),
    services,
    professionals,
  };
}

export type InvitePeekStatus =
  | "valid"
  | "expired"
  | "revoked"
  | "accepted"
  | "not_found";

export type InvitePeek = {
  status: InvitePeekStatus;
  workspaceName: string | null;
  role: string | null;
  emailBound: boolean;
  expiresAt: string | null;
};

export function parseInvitePeek(raw: unknown): InvitePeek {
  if (!raw || typeof raw !== "object") {
    return {
      status: "not_found",
      workspaceName: null,
      role: null,
      emailBound: false,
      expiresAt: null,
    };
  }
  const data = raw as Record<string, unknown>;
  const status = asString(data.status);
  const allowed: InvitePeekStatus[] = ["valid", "expired", "revoked", "accepted", "not_found"];
  return {
    status: allowed.includes(status as InvitePeekStatus) ? (status as InvitePeekStatus) : "not_found",
    workspaceName: asString(data.workspace_name),
    role: asString(data.role),
    emailBound: data.email_bound === true,
    expiresAt: asString(data.expires_at),
  };
}

export type SeatUsage = {
  plan: "solo" | "equipe" | "salao";
  maxProfessionals: number;
  usedProfessionals: number;
};

export function parseSeatUsage(raw: unknown): SeatUsage | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const data = raw as Record<string, unknown>;
  const plan = asString(data.plan);
  if (plan !== "solo" && plan !== "equipe" && plan !== "salao") {
    return null;
  }
  return {
    plan,
    maxProfessionals: asNumber(data.max_professionals, 1),
    usedProfessionals: asNumber(data.used_professionals, 0),
  };
}
