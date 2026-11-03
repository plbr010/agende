import { normalizeEmail } from "@/lib/validation/email";

/** Official SaaS owner. Authorization is bound to this account's auth.users.id. */
export const OFFICIAL_MASTER_ADMIN_EMAIL = "plbrpc@gmail.com";

export function isOfficialMasterAdminEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email ?? "") === OFFICIAL_MASTER_ADMIN_EMAIL;
}
