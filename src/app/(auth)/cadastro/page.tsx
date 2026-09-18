import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { requireAnonymous } from "@/lib/auth/session";

export default async function CadastroPage() {
  await requireAnonymous();

  return (
    <div className="space-y-6">
      <SignupForm />
      <p className="text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </div>
  );
}
