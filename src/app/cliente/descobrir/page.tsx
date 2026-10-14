import { MapPin } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { LocationDiscovery } from "@/components/discovery/location-discovery";
import { loadMyAppointmentsResult } from "@/lib/booking/queries";
import { uniqueClientWorkspaces } from "@/lib/booking/validation";
import { loadWorkspaceFavorites } from "@/lib/client/favorite-actions";
import { favoritesViewFromLoad } from "@/lib/client/favorites";
import { DISCOVERY_COPY } from "@/lib/discovery/contract";

export default async function ClienteDescobrirPage() {
  await requireConfirmedSession("/cliente/descobrir");
  const [appointmentsResult, favorites] = await Promise.all([
    loadMyAppointmentsResult(),
    loadWorkspaceFavorites().then(favoritesViewFromLoad),
  ]);
  const knownWorkspaces = uniqueClientWorkspaces(appointmentsResult.appointments);
  const savedFavorites = Object.fromEntries(favorites.items.map((item) => [item.slug, item.workspaceId]));

  return (
    <>
      <PageHeader
        eyebrow="Explorar"
        title={DISCOVERY_COPY.title}
        description={DISCOVERY_COPY.description}
        icon={MapPin}
      />
      <LocationDiscovery knownWorkspaces={knownWorkspaces} canSaveFavorites savedFavorites={savedFavorites} />
    </>
  );
}
