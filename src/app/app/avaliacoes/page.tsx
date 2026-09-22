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
        <MetricCard label="Nota média" value="—" hint="aguardando avaliações remotas" icon={Star} />
        <MetricCard label="Respostas" value="—" hint="feedbacks recebidos" icon={MessageCircleHeart} tone="success" />
        <MetricCard label="Recomendação" value="—" hint="experiências positivas" icon={ThumbsUp} tone="warning" />
      </section>
      <IntegrationBanner description="O painel profissional e a jornada da cliente estão estruturados. Elegibilidade, unicidade por atendimento, moderação e publicação dependem das regras já existentes no Supabase remoto." />
      <EmptyModuleState
        icon={UsersRound}
        title="Feedback que ajuda a crescer"
        description="Quando o schema remoto estiver sincronizado, esta área exibirá notas, comentários e respostas vinculados aos atendimentos reais."
        capabilities={["Avaliação vinculada a atendimento concluído", "Nota de 1 a 5 e comentário opcional", "Resposta do estabelecimento", "Indicadores de satisfação e reputação"]}
      />
    </>
  );
}
