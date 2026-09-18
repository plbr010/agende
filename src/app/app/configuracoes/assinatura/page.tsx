import { requireConfirmedSession } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/lib/workspace/labels";
import { loadSeatUsage, loadSubscriptionDetail, loadWorkspaceSettings } from "@/lib/workspace/queries";
import { formatDateTime } from "@/lib/workspace/timezone";

export default async function SubscriptionSettingsPage() {
  const session = await requireConfirmedSession("/app/configuracoes/assinatura");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return null;
  }
  const [subscription, seats, settings] = await Promise.all([
    loadSubscriptionDetail(workspace.id),
    loadSeatUsage(workspace.id),
    loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug),
  ]);
  const timezone = settings.timezone;

  return (
    <div className="grid gap-4">
      <Card className="border-none ring-1 ring-border">
        <CardHeader>
          <CardTitle>Plano do estabelecimento</CardTitle>
          <CardDescription>
            A assinatura pertence ao negócio. Pagamento e troca de plano entram em uma etapa
            futura — sem checkout inventado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge>{PLAN_LABEL[subscription?.plan ?? "solo"]}</Badge>
            <Badge variant="secondary">
              {SUBSCRIPTION_STATUS_LABEL[subscription?.status ?? "expired"]}
            </Badge>
          </div>
          {seats ? (
            <p className="font-serif text-3xl">
              {seats.usedProfessionals} de {seats.maxProfessionals} profissionais
            </p>
          ) : null}
          <p className="text-sm">Trial iniciado: {formatDateTime(subscription?.trialStartedAt, timezone)}</p>
          <p className="text-sm">Trial termina: {formatDateTime(subscription?.trialEndsAt, timezone)}</p>
          <p className="text-sm">
            Período atual: {formatDateTime(subscription?.currentPeriodStart, timezone)} →{" "}
            {formatDateTime(subscription?.currentPeriodEnd, timezone)}
          </p>
        </CardContent>
      </Card>
      <Card className="border-none bg-secondary/40 ring-1 ring-border">
        <CardHeader>
          <CardTitle>Gerenciamento de pagamento em breve</CardTitle>
          <CardDescription>
            Não é possível alterar o plano por aqui. Quando o gateway existir, esta página será o
            lugar.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
