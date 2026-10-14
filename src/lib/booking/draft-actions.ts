"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BOOKING_DRAFT_COOKIE, BOOKING_DRAFT_TTL, bookingDraftSchema, type BookingDraft } from "./draft";
import { fetchPublicSlotsAction } from "./actions";

export async function continueBookingAfterLogin(input: BookingDraft): Promise<{ error: string } | never> {
  const parsed = bookingDraftSchema.safeParse(input);
  if (!parsed.success) return { error: "Escolha um horário válido." };
  const result = await fetchPublicSlotsAction(parsed.data);
  if (!result.slots.some(slot => Date.parse(slot) === Date.parse(parsed.data.startsAt)))
    return { error: "Este horário não está mais disponível. Escolha outro." };
  const store = await cookies();
  store.set(BOOKING_DRAFT_COOKIE, JSON.stringify({ selection: parsed.data, expiresAt: Date.now() + BOOKING_DRAFT_TTL * 1000 }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: BOOKING_DRAFT_TTL,
  });
  redirect(`/login?next=${encodeURIComponent(`/p/${parsed.data.slug}/agendar`)}`);
}
