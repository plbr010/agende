import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { ClientShell } from "@/components/client/client-shell";
import { FavoritesPanel } from "@/components/client/favorites-panel";
import { PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = {
  title: "Prévia · Favoritos",
  robots: { index: false, follow: false },
};

export default function IdentidadeClienteFavoritosPreviewPage() {
  return (
    <div className="bg-[var(--cream)]">
      <p className="bg-wine-deep px-4 py-3 text-center text-sm text-white">
        Prévia visual — lista vazia, como uma conta nova. Nada foi salvo neste navegador.
        {" "}
        <a href="/identidade/cliente" className="underline underline-offset-4">Voltar ao início</a>
      </p>
      <ClientShell userName="Ana Souza" hasWorkspace={false}>
        <PageHeader
          eyebrow="Os seus"
          title="Favoritos"
          description="Salões que você guardou na sua conta. Abra o perfil ou agende de novo quando quiser."
          icon={Heart}
        />
        <FavoritesPanel favorites={{ status: "ready", items: [] }} />
      </ClientShell>
    </div>
  );
}
