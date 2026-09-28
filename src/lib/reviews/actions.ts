"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reviewDraftSchema } from "@/lib/reviews/validation";
import { loadReviews, type AppointmentReview } from "@/lib/reviews/queries";

export async function submitReview(input: { appointmentId: string; rating: number; comment: string }): Promise<{ error?: string; reviews?: AppointmentReview[] }> {
  const parsed = reviewDraftSchema.safeParse(input);
  if (!parsed.success) return { error: "Escolha uma nota de 1 a 5 e um comentário de até 500 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_appointment_review", {
    p_appointment_id: parsed.data.appointmentId, p_rating: parsed.data.rating, p_comment: parsed.data.comment,
  });
  if (error) {
    if (error.message.includes("already_reviewed")) return { error: "Este atendimento já foi avaliado. Atualize a página para ver sua avaliação." };
    if (error.message.includes("not_completed")) return { error: "Somente atendimentos concluídos podem ser avaliados." };
    if (error.message.includes("not_found")) return { error: "Atendimento não encontrado na sua conta." };
    return { error: "Não foi possível enviar sua avaliação. Tente novamente." };
  }
  revalidatePath("/cliente/avaliacoes");
  revalidatePath("/app/avaliacoes");
  return { reviews: await loadReviews() };
}
