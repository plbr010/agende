import Link from "next/link";
import { ResendEmailButton } from "@/components/auth/resend-email-button";
import { OnboardingProgressSteps } from "@/components/onboarding/progress-steps";
import { getPendingEmail } from "@/lib/auth/actions";
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
  const session = await loadAppSession();
  if (session?.context.emailConfirmed) {
    redirect(getDefaultDestination(session.context));
  }

  const { status } = await searchParams;
  const pendingEmail = await getPendingEmail();
  const key = status && copy[status] ? status : "loading";
  const content = copy[key];
  const showLoginCta = ["success", "loading", "sent", "error", "browser_mismatch"].includes(key);

  return (
    <div className="space-y-6">
      <OnboardingProgressSteps current={1} />
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">Próximo passo</p>
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
      <ResendEmailButton />
      {showLoginCta ? (
        <div className="grid gap-3">
          <Button className="h-11" render={<Link href="/login" />}>
            Já confirmei — entrar
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Depois de entrar, o Agendê te leva para o próximo passo.
          </p>
        </div>
      ) : null}
    </div>
  );
}
