import Link from "next/link";
import { InviteEntry } from "@/components/auth/invite-entry";
import { SignupChooser } from "@/components/auth/signup-chooser";
import { SignupForm } from "@/components/auth/signup-form";
import { CLIENT_JOURNEY, JourneySteps, OWNER_JOURNEY, TEAM_JOURNEY } from "@/components/onboarding/progress-steps";
import { requireAnonymous } from "@/lib/auth/session";
import { sanitizeNextPath } from "@/lib/auth/redirects";
import { extractInviteToken, resolveSignupJourney } from "@/lib/auth/signup-journey";
import { parsePlanId } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";
import { parseInvitePeek, type InvitePeek } from "@/lib/workspace/public";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; plan?: string; intent?: string; opcoes?: string }>;
}) {
  const { next, plan: planParam, intent: intentParam, opcoes } = await searchParams;
  const safeNext = sanitizeNextPath(next);
  const plan = parsePlanId(planParam);
  const journey = resolveSignupJourney({
    intent: intentParam,
    plan: planParam,
    next: safeNext,
    forceChoice: opcoes === "1",
  });
  await requireAnonymous(safeNext);

  const options = new URLSearchParams({ opcoes: "1" });
  if (safeNext) options.set("next", safeNext);
  if (plan) options.set("plan", plan);

  if (!journey) {
    return <SignupChooser next={safeNext} plan={plan} />;
  }

  let peek: InvitePeek | null = null;
  let lookupError: string | null = null;
  const inviteToken = journey === "team" ? extractInviteToken(safeNext) : null;
  if (inviteToken) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("peek_workspace_invite", { p_token: inviteToken });
    if (error) {
      lookupError = "Não foi possível conferir o convite agora. O link continua guardado. Tente de novo.";
    } else {
      peek = parseInvitePeek(data);
    }
  }

  const clientJourney = journey === "client";
  const ownerJourney = journey === "owner";

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <JourneySteps
        steps={clientJourney ? CLIENT_JOURNEY : ownerJourney ? OWNER_JOURNEY : TEAM_JOURNEY}
        current={journey === "team" && peek?.status === "valid" ? 2 : 1}
        label={clientJourney ? "Cadastro de cliente" : ownerJourney ? "Cadastro do salão" : "Cadastro da equipe"}
      />
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">
          {clientJourney ? "Quero agendar serviços" : ownerJourney ? "Tenho meu próprio salão" : "Trabalho em um salão parceiro"}
        </p>
        <h1 className="mt-2 font-serif text-4xl text-wine-deep">
          {clientJourney ? "Criar conta de cliente" : ownerJourney ? "Criar conta do salão" : "Entrar na equipe"}
        </h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          {clientJourney
            ? "Depois do e-mail, você confere o perfil e encontra estabelecimentos. Não pedimos nome de salão nem plano."
            : ownerJourney
              ? "Depois do e-mail, você escolhe o plano, começa o teste de 7 dias e cadastra o salão."
              : "Confira o convite, crie a conta e aceite. Sem mensalidade."}
        </p>
      </div>
      {safeNext?.includes("/agendar") ? (
        <p role="status" className="rounded-[1.25rem] bg-metric-blush px-4 py-3 text-sm leading-6">
          Serviço, profissional, dia e horário continuam escolhidos. Depois de criar a conta e confirmar o e-mail, você volta para concluir. Se o horário for ocupado nesse meio-tempo, avisamos para escolher outro.
        </p>
      ) : null}
      {journey === "team" ? (
        <InviteEntry
          peek={peek}
          lookupError={lookupError}
          next={inviteToken ? `/convite/${inviteToken}` : null}
          presetLink={safeNext}
        />
      ) : (
        <SignupForm next={safeNext} plan={ownerJourney ? plan : null} journey={journey} />
      )}
      <p className="text-sm text-muted-foreground">
        <Link href={`/cadastro?${options.toString()}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
          Ver as outras opções
        </Link>
        {" · "}
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
