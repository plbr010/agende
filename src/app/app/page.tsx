import Link from "next/link";
import { requireConfirmedSession } from "@/lib/auth/session";
import { enableClientProfileAction } from "@/lib/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadClients, loadServices, loadTeam } from "@/lib/catalog/queries";

import { formatDateTime } from "@/lib/workspace/timezone";
import { PLAN_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/lib/workspace/labels";
import { loadWorkspaceSettings } from "@/lib/workspace/queries";

export default async function AppPage() {
  const session = await requireConfirmedSession("/app");
  const workspace = session.workspaces[0];
  const [team, services, clients, settings] = workspace
    ? await Promise.all([
        loadTeam(workspace.id),
        loadServices(workspace.id),
        loadClients(workspace.id),
        loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug),
      ])
    : [[], [], [], null];
  const timezone = settings?.timezone;

  return (
    <>
      <div>
        <p className="text-sm text-muted-foreground">Área profissional</p>
        <h1 className="font-serif text-3xl">{workspace?.name ?? "Seu negócio"}</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/app/equipe">
          <Card className="h-full border-none ring-1 ring-border transition-colors hover:bg-secondary/40">
            <CardHeader>
              <CardTitle>Equipe</CardTitle>
              <CardDescription>Quem atende no seu espaço.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-serif text-3xl">{team.length}</p>
              <p className="text-sm text-muted-foreground">pessoas no workspace</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/servicos">
          <Card className="h-full border-none ring-1 ring-border transition-colors hover:bg-secondary/40">
            <CardHeader>
              <CardTitle>Serviços</CardTitle>
              <CardDescription>Catálogo com preço e duração.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-serif text-3xl">{services.length}</p>
              <p className="text-sm text-muted-foreground">serviços ativos no cadastro</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/clientes">
          <Card className="h-full border-none ring-1 ring-border transition-colors hover:bg-secondary/40">
            <CardHeader>
              <CardTitle>Clientes</CardTitle>
              <CardDescription>Cadastro interno do salão.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-serif text-3xl">{clients.length}</p>
              <p className="text-sm text-muted-foreground">clientes do estabelecimento</p>
            </CardContent>
          </Card>
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-none ring-1 ring-border">
          <CardHeader>
            <CardTitle>Assinatura do workspace</CardTitle>
            <CardDescription>
              Pertence ao negócio, não à sua conta pessoal. Datas vêm do banco.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge>{PLAN_LABEL[session.subscription?.plan ?? "solo"]}</Badge>
              <Badge variant="secondary">
                {SUBSCRIPTION_STATUS_LABEL[session.subscription?.status ?? "expired"]}
              </Badge>
            </div>
            <p className="text-sm">
              Trial iniciado: {formatDateTime(session.subscription?.trialStartedAt ?? null, timezone)}
            </p>
            <p className="text-sm">
              Trial termina: {formatDateTime(session.subscription?.trialEndsAt ?? null, timezone)}
            </p>
            <p className="text-sm text-muted-foreground">
              Papel: {workspace?.role ?? "—"}. Página pública: /p/{workspace?.slug}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none ring-1 ring-border">
          <CardHeader>
            <CardTitle>Agenda</CardTitle>
            <CardDescription>
              A agenda, o financeiro e o estoque ficam para as próximas etapas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!session.context.hasClientProfile ? (
              <form action={enableClientProfileAction}>
                <Button variant="outline" type="submit" className="h-11">
                  Também quero agendar como cliente
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sua conta também tem perfil de cliente.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
