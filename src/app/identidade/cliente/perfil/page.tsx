import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { ClientShell } from "@/components/client/client-shell";
import { AccountPhotoEditor } from "@/components/account/account-photo-editor";
import { ClientProfileForm } from "@/components/client/client-profile-form";
import { PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = {
  title: "Prévia · Perfil",
  robots: { index: false, follow: false },
};

export default function IdentidadeClientePerfilPreviewPage() {
  return (
    <div className="bg-[var(--cream)]">
      <p className="bg-wine-deep px-4 py-3 text-center text-sm text-white">
        Prévia visual do perfil — cidade opcional e iniciais no lugar da foto. O envio da foto acontece na conta de verdade.
        {" "}
        <a href="/identidade/cliente" className="underline underline-offset-4">Voltar ao início</a>
      </p>
      <ClientShell userName="Ana Souza" hasWorkspace={false}>
        <PageHeader
          eyebrow="Sua conta"
          title="Perfil"
          description="Nome, celular, cidade e e-mail. A cidade é opcional e não muda a busca."
          icon={UserRound}
        />
        <section className="relative overflow-hidden rounded-[1.8rem] bg-white p-6 ring-1 ring-[#f0e4de] sm:p-8">
          <h2 className="font-serif text-2xl text-wine-deep">Sua foto</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            A prévia mostra o enquadramento. A foto só fica salva na conta de verdade, depois que o envio termina.
          </p>
          <div className="mt-6">
            <AccountPhotoEditor name="Ana Souza" hasAvatar={false} version={null} />
          </div>
        </section>
        <section className="relative overflow-hidden rounded-[1.8rem] bg-white p-6 ring-1 ring-[#f0e4de] sm:p-8">
          <h2 className="font-serif text-2xl text-wine-deep">Seus dados</h2>
          <ClientProfileForm fullName="Ana Souza" phone="+5532999999999" email="ana@example.com" residenceCity="" />
        </section>
      </ClientShell>
    </div>
  );
}
