import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { FavoritesPanel } from "@/components/client/favorites-panel";
import { loadWorkspaceFavorites } from "@/lib/client/favorite-actions";
import { favoritesViewFromLoad } from "@/lib/client/favorites";

export const metadata: Metadata = {
  title: "Favoritos",
};

export default async function ClienteFavoritosPage() {
  await requireConfirmedSession("/cliente/favoritos");
  const favorites = favoritesViewFromLoad(await loadWorkspaceFavorites());

  return (
    <>
      <PageHeader
        eyebrow="Os seus"
        title="Favoritos"
        description="Salões que você guardou na sua conta. Abra o perfil ou agende de novo quando quiser."
        icon={Heart}
      />
      <FavoritesPanel favorites={favorites} />
    </>
  );
}
