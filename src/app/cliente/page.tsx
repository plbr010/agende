import Link from "next/link";
import { requireConfirmedSession } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClientePage() {
  const session = await requireConfirmedSession("/cliente");

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
          <p className="text-sm text-muted-foreground">Área do cliente</p>
          <h1 className="font-serif text-3xl">Olá, {session.profile.fullName}</h1>
          <p className="mt-2 text-muted-foreground">
            Esta área é gratuita. Sem mensalidade, sem trial e sem assinatura.
          </p>
        </div>
        <Card className="border-none ring-1 ring-border">
          <CardHeader>
            <CardTitle>Meus agendamentos</CardTitle>
            <CardDescription>
              Veja horários à frente, histórico e cancele com até 2 horas de antecedência.
            </CardDescription>
          </CardHeader>
        </Card>
        <Button className="h-11 w-fit rounded-full" render={<Link href="/cliente/agendamentos" />}>
          Abrir agendamentos
        </Button>
        {session.context.hasWorkspace ? (
          <Button variant="outline" className="w-fit" render={<Link href="/app" />}>
            Ir para o meu negócio
          </Button>
        ) : (
          <Button variant="outline" className="w-fit" render={<Link href="/onboarding" />}>
            Quero também ser profissional
          </Button>
        )}
      </main>
    </div>
  );
}
