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
        Prévia visual — favoritos sem persistência no servidor. Nada foi salvo neste navegador.
        {" "}
        <a href="/identidade/cliente" className="underline underline-offset-4">Voltar ao início</a>
      </p>
      <ClientShell userName="Ana Souza" hasWorkspace={false}>
        <PageHeader
          eyebrow="Os seus"
          title="Favoritos"
          description="Guarde os salões que você quer revisitar. A lista só aparece quando o servidor puder salvá-la na sua conta."
          icon={Heart}
        />
        <FavoritesPanel />
      </ClientShell>
    </div>
  );
}
