import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { FavoritesPanel } from "@/components/client/favorites-panel";

export const metadata: Metadata = {
  title: "Favoritos",
};

export default async function ClienteFavoritosPage() {
  await requireConfirmedSession("/cliente/favoritos");

  return (
    <>
      <PageHeader
        eyebrow="Os seus"
        title="Favoritos"
        description="Guarde os salões que você quer revisitar. A lista só aparece quando o servidor puder salvá-la na sua conta."
        icon={Heart}
      />
      <FavoritesPanel />
    </>
  );
}
