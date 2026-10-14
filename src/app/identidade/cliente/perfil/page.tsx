import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { ClientShell } from "@/components/client/client-shell";
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
        Prévia visual do perfil — nome e telefone já existentes. Foto, cidade e notificações aguardam o servidor.
        {" "}
        <a href="/identidade/cliente" className="underline underline-offset-4">Voltar ao início</a>
      </p>
      <ClientShell userName="Ana Souza" hasWorkspace={false}>
        <PageHeader
          eyebrow="Sua conta"
          title="Perfil"
          description="Só o que a sua conta já guarda: nome, telefone e e-mail. Nada daqui aparece em páginas públicas."
          icon={UserRound}
        />
        <section className="relative overflow-hidden rounded-[1.8rem] bg-white p-6 ring-1 ring-[#f0e4de] sm:p-8">
          <h2 className="font-serif text-2xl text-wine-deep">Seus dados</h2>
          <ClientProfileForm fullName="Ana Souza" phone="+5532999999999" email="ana@example.com" />
        </section>
      </ClientShell>
    </div>
  );
}
