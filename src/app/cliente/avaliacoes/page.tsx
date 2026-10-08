import { Star } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { loadMyAppointments } from "@/lib/booking/queries";
import { PageHeader } from "@/components/app/page-header";
import { loadReviews } from "@/lib/reviews/queries";
import { ReviewCenter } from "@/components/reviews/review-center";
import { eligibleReviewAppointments } from "@/lib/reviews/validation";

export default async function ClientReviewsPage() {
  await requireConfirmedSession("/cliente/avaliacoes");
  const [appointments, reviews] = await Promise.all([loadMyAppointments(), loadReviews()]);
  const eligible = eligibleReviewAppointments(appointments);

  return (
    <>
      <PageHeader
        eyebrow="Sua experiência"
        title="Avaliações"
        description="Relembre atendimentos concluídos e prepare um feedback para quem cuidou de você."
        icon={Star}
      />
      {reviews === null ? (
        <p role="status">As avaliações estão temporariamente indisponíveis. Seus agendamentos continuam disponíveis.</p>
      ) : (
        <ReviewCenter appointments={eligible} initialReviews={reviews} />
      )}
    </>
  );
}
