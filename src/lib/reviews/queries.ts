import { createClient } from "@/lib/supabase/server";

export type AppointmentReview = {
  appointment_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type ReviewsQueryResult = {
  reviews: AppointmentReview[];
  schemaReady: boolean;
};

export function isMissingReviewsRelation(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) {
    return false;
  }
  const code = error.code ?? "";
  const message = error.message ?? "";
  // Explicit permission/auth/transport codes must not be hidden by a message.
  if (code) return code === "42P01" || code === "PGRST205";
  return (
    (/appointment_reviews/i.test(message) &&
      /does not exist|schema cache|could not find/i.test(message))
  );
}

export async function loadReviewsResult(workspaceId?: string): Promise<ReviewsQueryResult> {
  const supabase = await createClient();
  let query = supabase
    .from("appointment_reviews")
    .select("appointment_id,rating,comment,created_at")
    .order("created_at", { ascending: false });

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { reviews: [], schemaReady: true };
    }
    query = query.eq("client_user_id", user.id);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingReviewsRelation(error)) {
      return { reviews: [], schemaReady: false };
    }
    throw new Error("Não foi possível carregar as avaliações. Tente novamente.");
  }

  return { reviews: data ?? [], schemaReady: true };
}

export async function loadReviews(workspaceId?: string): Promise<AppointmentReview[]> {
  const { reviews } = await loadReviewsResult(workspaceId);
  return reviews;
}
