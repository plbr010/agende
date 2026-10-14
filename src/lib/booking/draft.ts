import { z } from "zod";

export const BOOKING_DRAFT_COOKIE = "agende_booking_draft";
export const BOOKING_DRAFT_TTL = 30 * 60;
export const bookingDraftSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  serviceId: z.string().uuid(),
  professionalMemberId: z.string().uuid().nullable(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startsAt: z.string().datetime({ offset: true }),
}).strict();
export type BookingDraft = z.infer<typeof bookingDraftSchema>;
export function decodeBookingDraft(raw: string | undefined, slug: string): BookingDraft | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value.expiresAt !== "number" || value.expiresAt <= Date.now() ||
      value.expiresAt > Date.now() + BOOKING_DRAFT_TTL * 1000) return null;
    const parsed = bookingDraftSchema.safeParse(value.selection);
    return parsed.success && parsed.data.slug === slug ? parsed.data : null;
  } catch { return null; }
}
