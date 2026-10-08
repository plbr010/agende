import Link from "next/link";
import { requireConfirmedSession } from "@/lib/auth/session";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";
import { getSelectedPlan, signOutAction } from "@/lib/auth/actions";
import { parsePlanId } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/logo";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const session = await requireConfirmedSession("/onboarding");
  const { plan: planParam } = await searchParams;
  const defaultPlan = parsePlanId(planParam) ?? (await getSelectedPlan()) ?? "equipe";

  return (
    <div className="agende-bloom min-h-full px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-8">
        <div className="flex items-center justify-between">
          <BrandLogo size="sm" />
          <form action={signOutAction}>
            <Button variant="ghost" type="submit" className="h-11">
              Sair
            </Button>
          </form>
        </div>
        <ol className="grid grid-cols-3 gap-2 text-center text-xs" aria-label="Passos do onboarding">
          <li className="rounded-full bg-secondary px-2 py-2 font-medium">1. Conta</li>
          <li className="rounded-full bg-primary px-2 py-2 font-medium text-primary-foreground" aria-current="step">
            2. Negócio
          </li>
          <li className="rounded-full bg-secondary/60 px-2 py-2 text-muted-foreground">3. Agenda</li>
        </ol>
        <div>
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">Primeiros passos</p>
          <h1 className="mt-2 font-serif text-3xl">Crie o seu negócio</h1>
          <p className="mt-3 text-muted-foreground">
            Olá, {session.profile.fullName}. Seu e-mail está confirmado. Dê um nome ao seu negócio e escolha o plano
            para começar os 7 dias grátis.
          </p>
        </div>
        <CreateWorkspaceForm defaultPlan={defaultPlan} />
        <p className="text-center text-sm text-muted-foreground">
          Ao continuar, você concorda com os{" "}
          <Link href="/termos" className="underline underline-offset-4">
            Termos
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" className="underline underline-offset-4">
            Privacidade
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
