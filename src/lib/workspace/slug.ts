export const RESERVED_WORKSPACE_SLUGS = [
  "app",
  "api",
  "auth",
  "login",
  "cadastro",
  "cliente",
  "onboarding",
  "admin",
  "www",
  "static",
  "assets",
  "termos",
  "privacidade",
  "verificar-email",
  "agende",
  "suporte",
  "billing",
  "faturamento",
  "p",
  "convite",
  "configuracoes",
  "equipe",
  "servicos",
  "clientes",
  "assinatura",
  "perfil",
] as const;

export const SLUG_MIN = 3;
export const SLUG_MAX = 60;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyPreview(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isReservedWorkspaceSlug(slug: string): boolean {
  return (RESERVED_WORKSPACE_SLUGS as readonly string[]).includes(slug);
}

export function slugError(slug: string): string | null {
  if (!slug || slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
    return `Use de ${SLUG_MIN} a ${SLUG_MAX} caracteres.`;
  }
  if (/\s/.test(slug) || !SLUG_PATTERN.test(slug)) {
    return "Use só letras minúsculas, números e hífen, sem espaços.";
  }
  if (isReservedWorkspaceSlug(slug)) {
    return "Este endereço é reservado. Escolha outro.";
  }
  return null;
}

export function publicProfilePath(slug: string): string {
  return `/p/${slug}`;
}

export function invitePath(token: string): string {
  return `/convite/${token}`;
}

export function formatPublicProfilePreview(host: string, slug: string): string {
  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `${cleanHost}/p/${slug || "meu-salao"}`;
}
