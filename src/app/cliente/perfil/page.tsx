import type { Metadata } from "next";
import Link from "next/link";
import { Bell, LogOut, Shield, Star, UserRound } from "lucide-react";
import { CLIENT_JOURNEY, JourneySteps } from "@/components/onboarding/progress-steps";
import { AccountPhotoEditor } from "@/components/account/account-photo-editor";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { ClientProfileForm } from "@/components/client/client-profile-form";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Perfil",
};

export default async function ClientePerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string }>;
}) {
  const session = await requireConfirmedSession("/cliente/perfil");
  const { inicio } = await searchParams;
  const starting = inicio === "1";

  return (
    <>
      {starting ? (
        <div className="grid gap-4 rounded-[1.8rem] bg-metric-blush p-6 ring-1 ring-[#f0e4de]">
          <JourneySteps steps={CLIENT_JOURNEY} current={3} label="Cadastro de cliente" />
          <div>
            <h2 className="font-serif text-3xl text-wine-deep">Seu perfil de cliente</h2>
            <p className="mt-2 text-base leading-7">
              Confira nome, celular e foto. Em seguida, busque um estabelecimento. Esta conta não tem plano nem mensalidade.
            </p>
          </div>
          <Button size="lg" className="w-full sm:w-fit" render={<Link href="/cliente/descobrir" />}>
            Buscar estabelecimentos
          </Button>
        </div>
      ) : null}

      <PageHeader
        eyebrow="Sua conta"
        title="Perfil"
        description="Nome, celular, cidade e foto. Nada disso aparece na página pública de um salão."
        icon={UserRound}
      />

      <section className="relative overflow-hidden rounded-[1.8rem] bg-white p-6 ring-1 ring-[#f0e4de] sm:p-8">
        <h2 className="font-serif text-2xl text-wine-deep">Sua foto</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
          Escolha uma imagem da galeria ou tire uma foto. Você pode ajustar, trocar ou remover. Sem foto, mostramos as suas iniciais.
        </p>
        <div className="mt-6">
          <AccountPhotoEditor
            name={session.profile.fullName}
            hasAvatar={session.profile.hasAvatar}
            version={session.profile.avatarVersion}
          />
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[1.8rem] bg-white p-6 ring-1 ring-[#f0e4de] sm:p-8">
        <h2 className="font-serif text-2xl text-wine-deep">Seus dados</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
          O nome e o celular podem ser alterados. A cidade é opcional e não muda a busca de salões.
        </p>
        <div className="mt-6">
          <ClientProfileForm
            fullName={session.profile.fullName}
            phone={session.profile.phone}
            email={session.profile.email}
            residenceCity={session.profile.residenceCity}
            residenceCityAvailable={session.profile.residenceCityAvailable}
          />
        </div>
      </section>

      <section>
        <article className="rounded-[1.6rem] bg-metric-ivory/80 p-5 ring-1 ring-[#f0e4de]">
          <span className="grid size-10 place-items-center rounded-2xl bg-white text-wine-deep">
            <Bell className="size-4" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-serif text-xl text-wine-deep">Avisos</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Ainda não dá para escolher avisos por aqui. Confirmações continuam acontecendo do jeito que o salão já usa.
          </p>
        </article>
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

