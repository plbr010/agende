import { Star } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { loadMyAppointments } from "@/lib/booking/queries";
import { PageHeader } from "@/components/app/page-header";
import { BackendContractNotice } from "@/components/modules/backend-contract-notice";
import { loadReviewsResult } from "@/lib/reviews/queries";
import { ReviewCenter } from "@/components/reviews/review-center";
import { eligibleReviewAppointments } from "@/lib/reviews/validation";

export default async function ClientReviewsPage() {
  await requireConfirmedSession("/cliente/avaliacoes");
  const [appointments, { reviews, schemaReady }] = await Promise.all([
    loadMyAppointments(),
    loadReviewsResult(),
  ]);
  const eligible = eligibleReviewAppointments(appointments);

  return (
    <>
      <PageHeader
        eyebrow="Sua experiência"
        title="Avaliações"
        description="Só atendimentos concluídos da sua conta. Sem notas inventadas e sem avaliar o de outra pessoa."
        icon={Star}
      />
      {!schemaReady ? (
        <BackendContractNotice
          title="Ainda não é possível publicar avaliações"
          description="As avaliações estão temporariamente indisponíveis. Seus agendamentos continuam disponíveis."
          fields={["Somente atendimentos concluídos", "Nota de 1 a 5", "Comentário opcional", "Envio único e irreversível"]}
        />
      ) : (
        <ReviewCenter appointments={eligible} initialReviews={reviews} />
      )}
    </>
  );
}
