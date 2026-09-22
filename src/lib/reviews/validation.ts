import { z } from "zod";
import type { MyAppointment } from "@/lib/booking/queries";

export const reviewDraftSchema = z.object({
  appointmentId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).transform((value) => value || null),
});

export type ReviewDraft = z.infer<typeof reviewDraftSchema>;

export function eligibleReviewAppointments(appointments: MyAppointment[]): MyAppointment[] {
  return appointments
    .filter((appointment) => appointment.status === "completed")
    .sort((left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime());
}
