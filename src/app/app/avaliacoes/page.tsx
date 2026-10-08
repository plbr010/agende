import { MessageCircleHeart, Star } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { BackendContractNotice } from "@/components/modules/backend-contract-notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadReviewsResult } from "@/lib/reviews/queries";
import { loadWorkspaceSettings } from "@/lib/workspace/queries";
import { formatDateTimeInTimeZone } from "@/lib/time/timezone";

export default async function ReviewsPage() {
  const session = await requireConfirmedSession("/app/avaliacoes");
  const workspace = session.workspaces[0];
  if (!workspace) return null;

  const [{ reviews, schemaReady }, settings] = await Promise.all([
    loadReviewsResult(workspace.id),
    loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug),
  ]);
  const average = reviews.length
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <>
      <PageHeader
        eyebrow="Sua equipe"
        title="Avaliações"
        description="Opiniões de clientes sobre atendimentos concluídos. As notas são imutáveis depois do envio."
        icon={Star}
      />
      {!schemaReady ? (
        <BackendContractNotice
          title="Avaliações ainda não estão no banco remoto"
          description="O aplicativo já está pronto. A tabela appointment_reviews precisa da migration de lançamento documentada em docs/migrations/launch-readiness-2026-10-08.md."
          fields={["Nota de 1 a 5", "Comentário opcional", "Uma avaliação por atendimento", "Isolamento por workspace"]}
        />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2" aria-label="Resumo das avaliações">
            <MetricCard label="Nota média" value={average} hint="somente atendimentos concluídos" icon={Star} />
            <MetricCard label="Avaliações" value={reviews.length} hint="visíveis para a equipe" icon={MessageCircleHeart} tone="neutral" />
          </section>
          <section className="grid gap-4">
            {reviews.length === 0 ? (
              <Card className="rounded-3xl border-border/70 bg-card/85">
                <CardContent className="grid place-items-center gap-3 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Star className="size-6" />
                  </div>
                  <div>
                    <p className="font-serif text-2xl">Nenhuma avaliação recebida</p>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      Quando uma cliente concluir um atendimento e enviar uma nota, ela aparece aqui para a equipe.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              reviews.map((review) => (
                <Card key={review.appointment_id} className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <span className="font-serif">{review.rating}</span>
                      <span className="text-sm font-medium text-muted-foreground">de 5</span>
                    </CardTitle>
                    <CardDescription>{formatDateTimeInTimeZone(review.created_at, settings.timezone)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6">{review.comment || "Sem comentário."}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}
