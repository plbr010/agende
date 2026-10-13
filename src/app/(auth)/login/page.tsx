import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { AuthPanel } from "@/components/app/auth-panel";
import { requireAnonymous } from "@/lib/auth/session";
import { sanitizeNextPath } from "@/lib/auth/redirects";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; password?: string }>;
}) {
  const { next, password } = await searchParams;
  const safeNext = sanitizeNextPath(next);
  await requireAnonymous(safeNext);

  return (
    <AuthPanel
      eyebrow="Área da conta"
      title="Entrar"
      description="Digite seu e-mail e senha para abrir o Agendê."
      footer={
        <p className="text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link
            href={safeNext ? `/cadastro?next=${encodeURIComponent(safeNext)}` : "/cadastro"}
            className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
          >
            Criar conta grátis
          </Link>
        </p>
      }
    >
      {password === "updated" ? (
        <p role="status" className="mb-4 rounded-2xl bg-metric-blush px-4 py-3 text-sm">
          Senha alterada. Entre com sua nova senha.
        </p>
      ) : null}
      <LoginForm next={safeNext} />
    </AuthPanel>
  );
}
