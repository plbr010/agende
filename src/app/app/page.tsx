import { requireConfirmedSession } from "@/lib/auth/session";
import { signOutAction, enableClientProfileAction } from "@/lib/auth/actions";
import { BrandLogo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

const planLabel = {
  solo: "Solo",
  equipe: "Equipe",
  salao: "Salão",
} as const;

const statusLabel = {
  trialing: "Em trial",
  active: "Ativa",
  past_due: "Pagamento pendente",
  expired: "Expirada",
  canceled: "Cancelada",
} as const;

export default async function AppPage() {
  const session = await requireConfirmedSession("/app");
  const workspace = session.workspaces[0];

  return (
    <div className="agende-bloom min-h-full">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <BrandLogo size="sm" />
          <form action={signOutAction}>
            <Button variant="ghost" type="submit">
              Sair
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">
        <div>
          <p className="text-sm text-muted-foreground">Área profissional</p>
          <h1 className="font-serif text-3xl">{workspace?.name ?? "Seu negócio"}</h1>
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
                <Badge>{planLabel[session.subscription?.plan ?? "solo"]}</Badge>
                <Badge variant="secondary">
                  {statusLabel[session.subscription?.status ?? "expired"]}
                </Badge>
              </div>
              <p className="text-sm">Trial iniciado: {formatDate(session.subscription?.trialStartedAt ?? null)}</p>
              <p className="text-sm">Trial termina: {formatDate(session.subscription?.trialEndsAt ?? null)}</p>
              <p className="text-sm text-muted-foreground">
                Papel: {workspace?.role ?? "—"}. Slug público futuro: /{workspace?.slug}
              </p>
            </CardContent>
          </Card>
          <Card className="border-none ring-1 ring-border">
            <CardHeader>
              <CardTitle>Próximos módulos</CardTitle>
              <CardDescription>
                Agenda, financeiro e estoque ficam para a próxima etapa. A fundação já isola cada negócio.
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
      </main>
    </div>
  );
}
