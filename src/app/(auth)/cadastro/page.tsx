import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { CLIENT_JOURNEY, JourneySteps, PROFESSIONAL_JOURNEY } from "@/components/onboarding/progress-steps";
import { requireAnonymous } from "@/lib/auth/session";
import { sanitizeNextPath } from "@/lib/auth/redirects";
import { parsePlanId } from "@/lib/billing/plans";
export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; plan?: string; intent?: string }>;
}) {
  const { next, plan: planParam, intent: intentParam } = await searchParams;
  const safeNext = sanitizeNextPath(next);
  const plan = parsePlanId(planParam);
  const inviteSignup = Boolean(safeNext?.startsWith("/convite/"));
  const intentFromQuery =
    intentParam === "client" || intentParam === "professional"
      ? intentParam
      : inviteSignup
        ? "professional"
        : plan
          ? "professional"
          : "";
  const clientJourney = intentFromQuery === "client";
  const professionalJourney = intentFromQuery === "professional";
  await requireAnonymous(safeNext);

  return (
    <div className="space-y-6">
      {clientJourney || professionalJourney ? (
        <JourneySteps
          steps={clientJourney ? CLIENT_JOURNEY : PROFESSIONAL_JOURNEY}
          current={1}
          label={clientJourney ? "Cadastro de cliente" : "Cadastro profissional"}
        />
      ) : null}
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">
          {clientJourney ? "Sou cliente" : professionalJourney ? "Sou profissional" : "Começar no Agendê"}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-wine-deep">
          {clientJourney ? "Criar conta de cliente" : professionalJourney ? "Criar conta profissional" : "Criar conta"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {clientJourney
            ? "Depois do e-mail, você completa o perfil e encontra estabelecimentos. Não pedimos nome de salão nem plano."
            : professionalJourney
              ? "Depois do e-mail, você cadastra o estabelecimento e começa o teste de 7 dias."
              : "Escolha se você quer marcar horários ou organizar o salão. Os dois cabem na mesma conta."}
        </p>
      </div>
      {safeNext?.includes("/agendar") ? (
        <p role="status" className="rounded-[1.25rem] bg-metric-blush px-4 py-3 text-sm leading-6">
          Serviço, profissional, dia e horário continuam escolhidos. Depois de criar a conta e confirmar o e-mail, você volta para concluir. Se o horário for ocupado nesse meio-tempo, avisamos para escolher outro.
        </p>
      ) : null}
      <SignupForm
        next={safeNext}
        plan={clientJourney ? null : plan}
        initialIntent={intentFromQuery}
        lockIntent={inviteSignup}
      />
      <p className="text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link
          href={safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : "/login"}
          className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
