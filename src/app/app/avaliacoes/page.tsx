import { MessageCircleHeart, Star, ThumbsUp, UsersRound } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { IntegrationBanner } from "@/components/modules/integration-banner";
import { EmptyModuleState } from "@/components/modules/empty-module-state";

export default async function ReviewsPage() {
  await requireConfirmedSession("/app/avaliacoes");

  return (
    <>
      <PageHeader
        eyebrow="Reputação"
        title="Avaliações"
        description="Transforme a experiência de cada atendimento em escuta, confiança e melhoria contínua."
        icon={Star}
      />
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo de avaliações">
        <MetricCard label="Nota média" value="—" hint="avaliações em breve" icon={Star} />
        <MetricCard label="Respostas" value="—" hint="feedbacks recebidos" icon={MessageCircleHeart} tone="success" />
        <MetricCard label="Recomendação" value="—" hint="experiências positivas" icon={ThumbsUp} tone="warning" />
      </section>
      <IntegrationBanner description="As avaliações estarão disponíveis em breve. Seus clientes poderão contar como foi o atendimento." />
      <EmptyModuleState
        icon={UsersRound}
        title="Feedback que ajuda a crescer"
        description="Em breve, acompanhe as notas e comentários dos seus clientes e responda às avaliações dos atendimentos."
        capabilities={["Avaliação vinculada a atendimento concluído", "Nota de 1 a 5 e comentário opcional", "Resposta do estabelecimento", "Indicadores de satisfação e reputação"]}
      />
    </>
  );
}
