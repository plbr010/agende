import { requireConfirmedSession } from "@/lib/auth/session";
import { CreateWorkspaceForm, PlanChoiceForm } from "@/components/workspace/create-workspace-form";
import { JourneySteps, OWNER_JOURNEY } from "@/components/onboarding/progress-steps";
import { getSelectedPlan, signOutAction } from "@/lib/auth/actions";
import { parsePlanId } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/logo";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; etapa?: string }>;
}) {
  const session = await requireConfirmedSession("/onboarding");
  const { plan: planParam, etapa } = await searchParams;
  const defaultPlan = parsePlanId(planParam) ?? (await getSelectedPlan()) ?? "equipe";
  const salonStep = etapa === "salao";

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
        <JourneySteps steps={OWNER_JOURNEY} current={salonStep ? 4 : 3} label="Cadastro do salão" />
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">Tenho meu próprio salão</p>
          <h1 className="mt-2 font-serif text-4xl text-wine-deep">{salonStep ? "Cadastre seu estabelecimento" : "Escolha o plano"}</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
            Oi, {session.profile.fullName.split(/\s+/)[0]}! {salonStep
              ? "Dê um nome ao espaço. O teste de 7 dias começa agora, sem cartão."
              : "Estes são os preços reais. O teste de 7 dias começa quando o salão for criado, sem cartão."}
          </p>
        </div>
        <div className="agende-panel rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de] sm:p-6">
          {salonStep ? <CreateWorkspaceForm defaultPlan={defaultPlan} /> : <PlanChoiceForm defaultPlan={defaultPlan} />}
        </div>
        <p className="text-center text-sm text-muted-foreground">Você já aceitou os termos no cadastro.</p>
      </div>
    </div>
  );
}
