import Link from "next/link";
import { ResendEmailButton } from "@/components/auth/resend-email-button";
import { CLIENT_JOURNEY, JourneySteps, OWNER_JOURNEY, TEAM_JOURNEY } from "@/components/onboarding/progress-steps";
import { getPendingEmail, getPendingIntent, getPendingJourney, getPendingNext } from "@/lib/auth/actions";
import { loadAppSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getDefaultDestination } from "@/lib/auth/redirects";
import { Button } from "@/components/ui/button";

const copy: Record<string, { title: string; body: string }> = {
  sent: {
    title: "Abra o e-mail que enviamos",
    body: "Abra o link da mensagem neste mesmo navegador e dispositivo para entrar no Agendê. Se não achar, olhe também o spam.",
  },
  unconfirmed: {
    title: "Falta confirmar seu e-mail",
    body: "Sua conta já existe. Abra o link do e-mail neste mesmo navegador e dispositivo.",
  },
  expired: {
    title: "Este link não vale mais",
    body: "Peça um e-mail novo e toque no link fresco para continuar.",
  },
  error: {
    title: "Não foi possível confirmar",
    body: "Se você já confirmou seu e-mail, entre com sua senha. Caso contrário, peça um novo e-mail e abra o link neste mesmo navegador e dispositivo.",
  },
  browser_mismatch: {
    title: "Continue no navegador do cadastro",
    body: "Este navegador não tem a verificação iniciada no cadastro. Volte ao navegador e dispositivo onde criou a conta. Se o e-mail já foi confirmado, entre com sua senha.",
  },
  session_unavailable: {
    title: "Tente entrar para continuar",
    body: "Não foi possível abrir sua conta agora. Entre com sua senha para retomar o acesso. Você não precisa abrir o mesmo link outra vez.",
  },
  success: {
    title: "E-mail confirmado",
    body: "Tudo certo. Agora você já pode entrar.",
  },
  loading: {
    title: "Falta confirmar seu e-mail",
    body: "Abra o link do e-mail neste mesmo navegador e dispositivo.",
  },
};

export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  // This public recovery view must not repeat the failed session read.
  // Protected pages still require the normal confirmed-session guard.
  const session = status === "session_unavailable" ? null : await loadAppSession();
  if (session?.context.emailConfirmed) {
    redirect(getDefaultDestination(session.context));
  }

  const pendingEmail = await getPendingEmail();
  const pendingNext = await getPendingNext();
  const loginHref = pendingNext ? `/login?next=${encodeURIComponent(pendingNext)}` : "/login";
  const pendingIntent = session?.context.intendedUse ?? (await getPendingIntent());
  const journey = await getPendingJourney();
  const teamJourney = journey === "team";
  const clientJourney = !teamJourney && (journey === "client" || (journey === null && pendingIntent !== "professional"));
  const key = status && copy[status] ? status : "loading";
  const content = copy[key];
  const showLoginCta = ["success", "loading", "sent", "error", "browser_mismatch", "session_unavailable"].includes(key);

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <JourneySteps
        steps={teamJourney ? TEAM_JOURNEY : clientJourney ? CLIENT_JOURNEY : OWNER_JOURNEY}
        current={teamJourney ? 3 : 2}
        label={teamJourney ? "Cadastro da equipe" : clientJourney ? "Cadastro de cliente" : "Cadastro do salão"}
      />
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">
          {teamJourney ? "Trabalho em um salão parceiro" : clientJourney ? "Quero agendar serviços" : "Tenho meu próprio salão"}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-wine-deep">{content.title}</h1>
        <p className="mt-3 text-muted-foreground">{content.body}</p>
      </div>
      <div className="agende-panel rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de]">
        <p className="text-sm text-muted-foreground">E-mail enviado para</p>
        <p className="mt-1 font-medium">
          {pendingEmail ?? session?.user.email ?? "o endereço informado no cadastro"}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Não encontrou? Verifique spam, promoções e a pasta de lixo eletrônico.
        </p>
      </div>
      {key !== "session_unavailable" ? <ResendEmailButton /> : null}
      {showLoginCta ? (
        <div className="grid gap-3">
          <Button className="h-11" render={<Link href={loginHref} />}>
            Já confirmei — entrar
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {pendingNext?.includes("/agendar")
              ? "Depois de entrar, você volta ao horário escolhido. A conta de cliente é grátis e não tem mensalidade."
              : teamJourney
                ? "Depois de entrar, você volta ao convite e aceita para abrir o painel. Sem mensalidade."
                : clientJourney
                  ? "Depois de entrar, você confere o perfil e pode buscar estabelecimentos."
                  : "Depois de entrar, você escolhe o plano, começa os 7 dias grátis e cadastra o salão."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
