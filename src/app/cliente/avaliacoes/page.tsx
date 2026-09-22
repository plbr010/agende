import { Star } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { loadMyAppointments } from "@/lib/booking/queries";
import { PageHeader } from "@/components/app/page-header";
import { IntegrationBanner } from "@/components/modules/integration-banner";
import { ReviewCenter } from "@/components/reviews/review-center";
import { eligibleReviewAppointments } from "@/lib/reviews/validation";

export default async function ClientReviewsPage() {
  await requireConfirmedSession("/cliente/avaliacoes");
  const appointments = await loadMyAppointments();
  const eligible = eligibleReviewAppointments(appointments);

  return (
    <>
      <PageHeader
        eyebrow="Sua experiência"
        title="Avaliações"
        description="Relembre atendimentos concluídos e prepare um feedback para quem cuidou de você."
        icon={Star}
      />
      <IntegrationBanner
        title="Compositor pronto, envio protegido"
        description="Os atendimentos concluídos abaixo vêm da sua conta real. O envio ficará bloqueado até o histórico remoto de avaliações ser sincronizado, evitando avaliações duplicadas."
      />
      <ReviewCenter appointments={eligible} />
    </>
  );
}
