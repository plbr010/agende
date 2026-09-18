import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { requireAnonymous } from "@/lib/auth/session";

export default async function LoginPage() {
  await requireAnonymous();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Entrar</h1>
        <p className="mt-2 text-muted-foreground">Acesse sua conta Agendê.</p>
      </div>
      <LoginForm />
      <p className="text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="text-foreground underline underline-offset-4">
          Começar agora
        </Link>
      </p>
    </div>
  );
}
