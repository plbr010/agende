export type SignupJourney = "client" | "owner" | "team";

const INVITE_TOKEN = /^[a-f0-9]{16,128}$/i;

export function extractInviteToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || value.length > 500) return null;
  if (INVITE_TOKEN.test(value)) return value.toLowerCase();
  if (value.startsWith("//") || (value.includes("://") && !/^https?:\/\//i.test(value))) return null;

  let pathname = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.username || url.password) return null;
      pathname = url.pathname;
    } catch {
      return null;
    }
  }

  const path = pathname.split(/[?#]/)[0] ?? pathname;
  const match = path.match(/(?:^|\/)convite\/([a-f0-9]{16,128})\/?$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function inviteReturnPath(token: string): string {
  return `/convite/${token}`;
}

export function resolveSignupJourney(input: {
  intent?: string | null;
  plan?: string | null;
  next?: string | null;
  forceChoice?: boolean;
}): SignupJourney | null {
  if (input.forceChoice) return null;
  if (input.next?.startsWith("/convite/")) return "team";
  const intent = (input.intent ?? "").trim().toLowerCase();
  if (intent === "client" || intent === "cliente") return "client";
  if (intent === "equipe" || intent === "team" || intent === "convite") return "team";
  if (intent === "professional" || intent === "profissional" || intent === "owner" || intent === "dono") return "owner";
  if (input.next?.includes("/agendar")) return "client";
  if (input.plan) return "owner";
  return null;
}

export function parseSignupJourney(value: unknown, intendedUse: "client" | "professional"): SignupJourney {
  if (value === "client" || value === "owner" || value === "team") return value;
  return intendedUse === "professional" ? "owner" : "client";
}

export function postConfirmationPath(input: {
  next: string | null;
  destination: string;
  journey: SignupJourney | null;
  hasClientProfile: boolean;
  intendedUse: "client" | "professional" | null;
}): string {
  if (input.next) return input.next;
  if (input.journey === "client" && input.intendedUse === "client" && input.hasClientProfile) {
    return "/cliente/perfil?inicio=1";
  }
  return input.destination;
}

export function signupChoiceHref(
  journey: SignupJourney,
  options?: { next?: string | null; plan?: string | null },
): string {
  const params = new URLSearchParams();
  params.set("intent", journey === "client" ? "cliente" : journey === "owner" ? "profissional" : "equipe");
  if (options?.plan && journey === "owner") params.set("plan", options.plan);
  if (options?.next) params.set("next", options.next);
  return `/cadastro?${params.toString()}`;
}

export const INVITE_STATUS_COPY = {
  valid: {
    title: "Convite encontrado",
    body: "Crie a conta ou entre. O acesso ao salão só começa depois que você confirmar o e-mail e aceitar o convite. Sem mensalidade.",
  },
  expired: {
    title: "Este convite expirou",
    body: "Peça um link novo para quem administra o salão. Este não pode mais ser usado.",
  },
  revoked: {
    title: "Este convite foi cancelado",
    body: "Quem administra o salão cancelou este convite. Ele não pode mais ser usado.",
  },
  accepted: {
    title: "Este convite já foi utilizado",
    body: "Se você já entrou na equipe, abra a área do salão. Se não foi você, peça um convite novo.",
  },
  not_found: {
    title: "Convite não encontrado",
    body: "O link pode estar incompleto ou nunca ter existido. Confira e cole de novo.",
  },
} as const;
