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
