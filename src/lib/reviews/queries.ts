import { createClient } from "@/lib/supabase/server";

export type AppointmentReview = { appointment_id: string; rating: number; comment: string | null; created_at: string };

// null means the reviews schema has not been deployed; [] means no reviews.
export async function loadReviews(workspaceId?: string): Promise<AppointmentReview[] | null> {
  const supabase = await createClient();
  let query = supabase.from("appointment_reviews").select("appointment_id,rating,comment,created_at").order("created_at", { ascending: false });
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  else {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    query = query.eq("client_user_id", user.id);
  }
  const { data, error } = await query;
  if (error?.code === "PGRST205" || error?.code === "42P01") return null;
  if (error) throw new Error("Não foi possível carregar as avaliações. Tente novamente.");
  return data ?? [];
}
