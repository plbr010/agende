import { MapPin } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { LocationDiscovery } from "@/components/discovery/location-discovery";
import { loadMyAppointmentsResult } from "@/lib/booking/queries";
import { uniqueClientWorkspaces } from "@/lib/booking/validation";
import { DISCOVERY_COPY } from "@/lib/discovery/contract";

export default async function ClienteDescobrirPage() {
  await requireConfirmedSession("/cliente/descobrir");
  const appointments = (await loadMyAppointmentsResult()).appointments;
  const knownWorkspaces = uniqueClientWorkspaces(appointments);

  return (
    <>
      <PageHeader
        eyebrow="Qualquer cidade"
        title={DISCOVERY_COPY.title}
        description={DISCOVERY_COPY.description}
        icon={MapPin}
      />
      <LocationDiscovery knownWorkspaces={knownWorkspaces} />
    </>
  );
}
