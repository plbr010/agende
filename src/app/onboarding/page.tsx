import { requireConfirmedSession } from "@/lib/auth/session";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";
import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/logo";

export default async function OnboardingPage() {
  const session = await requireConfirmedSession("/onboarding");

  return (
    <div className="agende-bloom min-h-full px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-8">
        <div className="flex items-center justify-between">
          <BrandLogo size="sm" />
          <form action={signOutAction}>
            <Button variant="ghost" type="submit">
              Sair
            </Button>
          </form>
        </div>
        <div>
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">Primeiros passos</p>
          <h1 className="mt-2 font-serif text-3xl">Crie o seu negócio</h1>
          <p className="mt-3 text-muted-foreground">
            Olá, {session.profile.fullName}. Seu e-mail está confirmado. Dê um nome ao seu negócio e escolha o plano para começar.
          </p>
        </div>
        <CreateWorkspaceForm />
      </div>
    </div>
  );
}
