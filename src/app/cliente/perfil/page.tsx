import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Camera, LogOut, Shield, Star, UserRound } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { ClientProfileForm } from "@/components/client/client-profile-form";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Perfil",
};

export default async function ClientePerfilPage() {
  const session = await requireConfirmedSession("/cliente/perfil");

  return (
    <>
      <PageHeader
        eyebrow="Sua conta"
        title="Perfil"
        description="Só o que a sua conta já guarda: nome, telefone e e-mail. Nada daqui aparece em páginas públicas."
        icon={UserRound}
      />

      <section className="relative overflow-hidden rounded-[1.8rem] bg-white p-6 ring-1 ring-[#f0e4de] sm:p-8">
        <h2 className="font-serif text-2xl text-wine-deep">Seus dados</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
          Estes campos vêm da sua conta autenticada. Alterações de nome e telefone usam a permissão já existente do perfil.
        </p>
        <div className="mt-6">
          <ClientProfileForm
            fullName={session.profile.fullName}
            phone={session.profile.phone}
            email={session.profile.email}
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <PendingPreference
          icon={Camera}
          title="Foto de perfil"
          description="O envio de foto precisa de armazenamento e regras de acesso. Ainda não está liberado — não há upload improvisado aqui."
        />
        <PendingPreference
          icon={Bell}
          title="Notificações"
          description="Confirmações, lembretes e pedidos de avaliação reutilizam a infraestrutura existente. Preferências nesta tela ainda não existem."
        />
      </section>

      <section className="grid gap-4 rounded-[1.8rem] bg-white p-6 ring-1 ring-[#f0e4de] sm:p-8">
        <div className="flex items-start gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-metric-blush text-wine-deep">
            <Shield className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-serif text-2xl text-wine-deep">Segurança</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Para trocar a senha, use a recuperação de acesso. O Agendê só confirma o envio depois que o servidor responder.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 rounded-full" render={<Link href="/recuperar-senha" />}>
            Alterar senha
          </Button>
          <Button variant="outline" className="h-11 rounded-full" render={<Link href="/cliente/avaliacoes" />}>
            <Star className="size-4" /> Avaliações
          </Button>
          {session.context.hasWorkspace ? (
            <Button variant="outline" className="h-11 rounded-full" render={<Link href="/app" />}>
              Área profissional
            </Button>
          ) : null}
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" className="h-11 rounded-full px-3">
            <LogOut className="size-4" /> Sair da conta
          </Button>
        </form>
      </section>
    </>
  );
}

function PendingPreference({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Camera;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[1.6rem] bg-metric-ivory/80 p-5 ring-1 ring-[#f0e4de]">
      <span className="grid size-10 place-items-center rounded-2xl bg-white text-wine-deep">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-serif text-xl text-wine-deep">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      <p className="mt-3 text-xs font-medium tracking-[0.14em] text-[var(--rose-ink)] uppercase">Aguardando o servidor</p>
    </article>
  );
}
