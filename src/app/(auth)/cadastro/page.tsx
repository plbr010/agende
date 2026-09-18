import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { requireAnonymous } from "@/lib/auth/session";
import { sanitizeNextPath } from "@/lib/auth/redirects";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = sanitizeNextPath(next);
  await requireAnonymous(safeNext);

  return (
    <div className="space-y-6">
      <SignupForm next={safeNext} />
      <p className="text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link
          href={safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : "/login"}
          className="text-foreground underline underline-offset-4"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
