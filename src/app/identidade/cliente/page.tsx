import type { Metadata } from "next";
import { ClientShell } from "@/components/client/client-shell";
import { ClientHome } from "@/components/client/client-home";

export const metadata: Metadata = {
  title: "Prévia da área da cliente",
  robots: { index: false, follow: false },
};

export default function IdentidadeClientePreviewPage() {
  return (
    <div className="bg-[var(--cream)]">
      <p className="bg-wine-deep px-4 py-3 text-center text-sm text-white">
        Prévia visual da área da cliente — estados vazios reais de uma conta nova. Nenhum agendamento, salão ou avaliação foi inventado.
        {" "}
        <a href="/identidade/cliente/favoritos" className="underline underline-offset-4">Favoritos</a>
        {" · "}
        <a href="/identidade/cliente/perfil" className="underline underline-offset-4">Perfil</a>
      </p>
      <ClientShell userName="Ana Souza" hasWorkspace={false}>
        <ClientHome firstName="Ana" next={null} loadError={null} recentWorkspaces={[]} completed={[]} />
      </ClientShell>
    </div>
  );
}
