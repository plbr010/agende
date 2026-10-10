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
    body: "Toque no link da mensagem para entrar no Agendê. Se não achar, olhe também o spam.",
  },
  unconfirmed: {
    title: "Falta confirmar seu e-mail",
    body: "Sua conta já existe. Abra o e-mail no celular, toque no link e volte para cá.",
  },
  expired: {
    title: "Este link não vale mais",
    body: "Peça um e-mail novo e toque no link fresco para continuar.",
  },
  error: {
    title: "Não foi possível confirmar",
    body: "Tente enviar o e-mail de novo. Se o problema continuar, use outro endereço.",
  },
  success: {
    title: "E-mail confirmado",
    body: "Tudo certo. Agora você já pode entrar.",
  },
  loading: {
    title: "Falta confirmar seu e-mail",
    body: "Abra o e-mail no celular, toque no link e volte para esta tela.",
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
  const showLoginCta = key === "success" || key === "loading" || key === "sent";

  return (
    <div className="space-y-6">
      <OnboardingProgressSteps current={1} />
      <div>
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">Próximo passo</p>
        <h1 className="mt-2 font-serif text-3xl">{content.title}</h1>
        <p className="mt-3 text-muted-foreground">{content.body}</p>
      </div>
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
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
