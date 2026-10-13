import { requireConfirmedSession } from "@/lib/auth/session";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";
import { OnboardingProgressSteps } from "@/components/onboarding/progress-steps";
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
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
          <BrandLogo size="sm" />
          <form action={signOutAction}>
            <Button variant="ghost" type="submit" className="h-11">
              Sair
            </Button>
          </form>
        </div>
        <OnboardingProgressSteps current={2} />
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">Primeiros passos</p>
          <h1 className="mt-2 font-serif text-3xl text-wine-deep">Cadastre seu salão</h1>
          <p className="mt-3 text-muted-foreground">
            Oi, {session.profile.fullName.split(/\s+/)[0]}! Coloque o nome do salão e escolha o plano. São 7 dias
            grátis, sem cartão. Se sair agora, entre de novo para continuar.
          </p>
        </div>
        <div className="agende-panel rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de] sm:p-6">
          <CreateWorkspaceForm defaultPlan={defaultPlan} />
        </div>
        <p className="text-center text-sm text-muted-foreground">Você já aceitou os termos no cadastro.</p>
      </div>
    </div>
  );
}
