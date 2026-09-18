import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { requireAnonymous } from "@/lib/auth/session";
import { sanitizeNextPath } from "@/lib/auth/redirects";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = sanitizeNextPath(next);
  await requireAnonymous(safeNext);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Entrar</h1>
        <p className="mt-2 text-muted-foreground">Acesse sua conta Agendê.</p>
      </div>
      <LoginForm next={safeNext} />
      <p className="text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link
          href={safeNext ? `/cadastro?next=${encodeURIComponent(safeNext)}` : "/cadastro"}
          className="text-foreground underline underline-offset-4"
        >
          Começar agora
        </Link>
      </p>
    </div>
  );
}
