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
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">Onboarding</p>
          <h1 className="mt-2 font-serif text-3xl">Crie o seu negócio</h1>
          <p className="mt-3 text-muted-foreground">
            Olá, {session.profile.fullName}. O trial de 7 dias começa somente quando o
            workspace for criado com sucesso — no servidor, não no relógio do celular.
          </p>
        </div>
        <CreateWorkspaceForm />
      </div>
    </div>
  );
}
