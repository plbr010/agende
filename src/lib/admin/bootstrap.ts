import { normalizeEmail } from "@/lib/validation/email";

export function masterAdminAllowlist(): string[] {
  const raw = process.env.AGENDE_MASTER_ADMIN_EMAILS ?? process.env.AGENDE_MASTER_ADMIN_EMAIL ?? "";
  return raw
    .split(/[,\n;]+/)
    .map((value) => normalizeEmail(value))
    .filter((value): value is string => Boolean(value));
}

export function isMasterAdminBootstrapEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email ?? "");
  return Boolean(normalized && masterAdminAllowlist().includes(normalized));
}
