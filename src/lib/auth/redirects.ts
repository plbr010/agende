export type SignupIntent = "client" | "professional";

export type AuthContext = {
  emailConfirmed: boolean;
  intendedUse: SignupIntent | null;
  hasWorkspace: boolean;
  hasClientProfile: boolean;
};

export function getDefaultDestination(ctx: AuthContext): string {
  if (!ctx.emailConfirmed) {
    return "/verificar-email";
  }
  if (ctx.hasWorkspace) {
    return "/app";
  }
  if (ctx.intendedUse === "professional") {
    return "/onboarding";
  }
  return "/cliente";
}

export function canAccessPath(path: string, ctx: AuthContext): boolean {
  if (!ctx.emailConfirmed) {
    return false;
  }
  if (path === "/app" || path.startsWith("/app/")) {
    return ctx.hasWorkspace;
  }
  if (path === "/onboarding" || path.startsWith("/onboarding/")) {
    return !ctx.hasWorkspace;
  }
  if (path === "/cliente" || path.startsWith("/cliente/")) {
    return ctx.hasClientProfile;
  }
  return true;
}

export function getFallbackForDeniedPath(path: string, ctx: AuthContext): string {
  if (!ctx.emailConfirmed) {
    return "/verificar-email";
  }
  if ((path === "/app" || path.startsWith("/app/")) && !ctx.hasWorkspace) {
    return ctx.intendedUse === "professional" ? "/onboarding" : "/cliente";
  }
  if ((path === "/cliente" || path.startsWith("/cliente/")) && !ctx.hasClientProfile) {
    return getDefaultDestination(ctx);
  }
  return getDefaultDestination(ctx);
}

export function sanitizeNextPath(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const value = raw.trim();
  // Reject encoded separators/control characters before URL normalization.
  let decoded = value;
  try {
    for (let i = 0; i < 3; i++) decoded = decodeURIComponent(decoded);
  } catch { return null; }
  if (/[\u0000-\u0020\u007f\\]/.test(decoded) || decoded.startsWith("//")) return null;
  const normalized = new URL(value, "https://agende.invalid");
  if (normalized.origin !== "https://agende.invalid") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  if (value.includes("://") || value.includes("\\")) {
    return null;
  }
  if (
    value.startsWith("/login") ||
    value.startsWith("/cadastro") ||
    value.startsWith("/auth") ||
    normalized.pathname.startsWith("/auth") ||
    normalized.pathname.startsWith("/login") ||
    normalized.pathname.startsWith("/cadastro") ||
    normalized.pathname.startsWith("/redefinir-senha") ||
    normalized.pathname.startsWith("/recuperar-senha")
  ) {
    return null;
  }
  return normalized.pathname + normalized.search + normalized.hash;
}
