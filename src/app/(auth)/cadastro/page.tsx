import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { requireAnonymous } from "@/lib/auth/session";
import { sanitizeNextPath } from "@/lib/auth/redirects";
import { parsePlanId } from "@/lib/billing/plans";
import { PLANS } from "@/lib/marketing/content";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; plan?: string; intent?: string }>;
}) {
  const { next, plan: planParam, intent: intentParam } = await searchParams;
  const safeNext = sanitizeNextPath(next);
  const plan = parsePlanId(planParam);
  const selectedPlan = plan ? PLANS.find((item) => item.id === plan) : null;
  const intentFromQuery =
    intentParam === "client" || intentParam === "professional" ? intentParam : "";
  await requireAnonymous(safeNext);

  return (
    <div className="space-y-6">
      {selectedPlan ? (
        <p className="rounded-2xl bg-secondary/70 px-4 py-3 text-sm">
          Você escolheu o plano <strong>{selectedPlan.name}</strong> ({selectedPlan.seats}). Depois de confirmar o
          e-mail, o trial de 7 dias começa nesse plano — sem cartão.
        </p>
      ) : null}
      <SignupForm
        next={safeNext}
        plan={plan}
        initialIntent={plan ? "professional" : intentFromQuery}
      />
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
