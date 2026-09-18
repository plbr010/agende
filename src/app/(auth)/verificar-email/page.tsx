import { ResendEmailButton } from "@/components/auth/resend-email-button";
import { getPendingEmail } from "@/lib/auth/actions";
import { loadAppSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getDefaultDestination } from "@/lib/auth/redirects";

const copy: Record<string, { title: string; body: string }> = {
  sent: {
    title: "E-mail enviado",
    body: "Confira sua caixa de entrada e o spam. O acesso protegido só abre depois da confirmação.",
  },
  unconfirmed: {
    title: "Confirme seu e-mail",
    body: "Sua conta existe, mas o e-mail ainda não foi confirmado.",
  },
  expired: {
    title: "Link expirado",
    body: "Esse link de confirmação não é mais válido. Reenvie um novo e-mail.",
  },
  error: {
    title: "Não foi possível confirmar",
    body: "Houve um problema ao validar o link. Tente reenviar o e-mail.",
  },
  success: {
    title: "E-mail confirmado",
    body: "Tudo certo. Você já pode entrar no Agendê.",
  },
  loading: {
    title: "Aguardando confirmação",
    body: "Assim que você clicar no link, voltamos aqui com o acesso liberado.",
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">Confirmação</p>
        <h1 className="mt-2 font-serif text-3xl">{content.title}</h1>
        <p className="mt-3 text-muted-foreground">{content.body}</p>
      </div>
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <p className="text-sm text-muted-foreground">E-mail enviado para</p>
        <p className="mt-1 font-medium">{pendingEmail ?? session?.user.email ?? "o endereço informado no cadastro"}</p>
      </div>
      <ResendEmailButton />
    </div>
  );
}
