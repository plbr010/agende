import { z } from "zod";
import { isValidEmail, normalizeEmail } from "@/lib/validation/email";
import { isValidPhone, normalizePhone } from "@/lib/validation/phone";
import { INVITE_ROLES, type InviteRole } from "@/lib/workspace/labels";
import { slugError, slugifyPreview } from "@/lib/workspace/slug";
import { isWorkspaceTimezone, DEFAULT_TIMEZONE } from "@/lib/workspace/timezone";

/** FormData.get() returns null when a field is omitted. Zod string() rejects null. */
const omittedToUndefined = (value: unknown) => (value == null ? undefined : value);

const optionalText = (max: number) =>
  z.preprocess(
    omittedToUndefined,
    z
      .string()
      .trim()
      .max(max, `Pode ter no máximo ${max} caracteres.`)
      .optional()
      .transform((value) => (value ? value : null)),
  );

const optionalTrimmed = z.preprocess(
  omittedToUndefined,
  z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
);

export const workspaceSettingsSchema = z.object({
  name: z.preprocess(
    omittedToUndefined,
    z
      .string()
      .trim()
      .min(2, "Informe o nome do estabelecimento (2 a 80 caracteres).")
      .max(80, "Informe o nome do estabelecimento (2 a 80 caracteres)."),
  ),
  slug: z.preprocess(
    omittedToUndefined,
    z
      .string()
      .trim()
      .transform((value) => slugifyPreview(value))
      .superRefine((value, ctx) => {
        const error = slugError(value);
        if (error) {
          ctx.addIssue({ code: "custom", message: error });
        }
      }),
  ),
  businessPhone: optionalTrimmed
    .superRefine((value, ctx) => {
      if (value && !isValidPhone(value)) {
        ctx.addIssue({ code: "custom", message: "Informe um telefone brasileiro válido, com DDD." });
      }
    })
    .transform((value) => (value ? normalizePhone(value) : null)),
  businessEmail: optionalTrimmed
    .transform((value) => (value ? normalizeEmail(value) : null))
    .superRefine((value, ctx) => {
      if (value && !isValidEmail(value)) {
        ctx.addIssue({ code: "custom", message: "Informe um e-mail comercial válido." });
      }
    }),
  description: optionalText(1000),
  address: optionalText(160),
  city: z.preprocess(
    omittedToUndefined,
    z
      .string()
      .trim()
      .max(80, "Cidade muito longa.")
      .optional()
      .transform((value) => (value ? value : null))
      .superRefine((value, ctx) => {
        if (value && value.length < 2) {
          ctx.addIssue({ code: "custom", message: "Informe uma cidade com pelo menos 2 letras." });
        }
      }),
  ),
  state: optionalTrimmed
    .transform((value) => (value ? value.toUpperCase() : null))
    .superRefine((value, ctx) => {
      if (value && !/^[A-Z]{2}$/.test(value)) {
        ctx.addIssue({ code: "custom", message: "Escolha um estado válido." });
      }
    }),
  postalCode: optionalTrimmed
    .transform((value) => {
      if (!value) return null;
      const digits = value.replace(/\D/g, "");
      return digits || null;
    })
    .superRefine((value, ctx) => {
      if (value && !/^\d{8}$/.test(value)) {
        ctx.addIssue({ code: "custom", message: "Informe um CEP com 8 dígitos." });
      }
    }),
  instagram: optionalTrimmed
    .transform((value) => {
      if (!value) return null;
      return value.replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");
    })
    .superRefine((value, ctx) => {
      if (!value) return;
      if (value.length > 30 || !/^[A-Za-z0-9._]+$/.test(value)) {
        ctx.addIssue({ code: "custom", message: "Informe um usuário de Instagram válido." });
      }
    }),
  timezone: z.preprocess(
    omittedToUndefined,
    z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && isWorkspaceTimezone(value) ? value : DEFAULT_TIMEZONE)),
  ),
  clearLogo: z.boolean().optional(),
});

export type WorkspaceSettingsInput = z.infer<typeof workspaceSettingsSchema>;

export function parseWorkspaceSettingsForm(formData: FormData) {
  const field = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : null;
  };
  return workspaceSettingsSchema.safeParse({
    name: field("name"),
    slug: field("slug"),
    businessPhone: field("businessPhone"),
    businessEmail: field("businessEmail"),
    description: field("description"),
    address: field("address"),
    city: field("city"),
    state: field("state"),
    postalCode: field("postalCode"),
    instagram: field("instagram"),
    timezone: field("timezone"),
    clearLogo: formData.get("clearLogo") === "true" || formData.get("clearLogo") === "on",
  });
}

export function parseInviteForm(formData: FormData):
  | { success: false; error: string; fieldErrors: Record<string, string> }
  | { success: true; data: { role: InviteRole; email: string | null } } {
  const emailRaw = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  if (!INVITE_ROLES.includes(role as InviteRole)) {
    return {
      success: false,
      error: "Escolha um papel válido. Dono não pode ser convidado.",
      fieldErrors: { role: "Papel inválido." },
    };
  }
  if (emailRaw && !isValidEmail(emailRaw)) {
    return {
      success: false,
      error: "Informe um e-mail válido ou deixe em branco para gerar um link secreto.",
      fieldErrors: { email: "E-mail inválido." },
    };
  }
  return {
    success: true,
    data: {
      role: role as InviteRole,
      email: emailRaw ? normalizeEmail(emailRaw) : null,
    },
  };
}

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function logoExtension(mime: string): "jpg" | "png" | "webp" | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}
