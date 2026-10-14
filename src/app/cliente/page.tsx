import { requireConfirmedSession } from "@/lib/auth/session";
import { ClientHome } from "@/components/client/client-home";
import { loadMyAppointmentsResult } from "@/lib/booking/queries";
import { groupClientAppointments, uniqueClientWorkspaces } from "@/lib/booking/validation";
import { firstNameFrom } from "@/lib/client/profile";

export default async function ClientePage() {
  const session = await requireConfirmedSession("/cliente");
  const appointmentsResult = await loadMyAppointmentsResult();
  const { upcoming, completed } = groupClientAppointments(appointmentsResult.appointments);

  return (
    <ClientHome
      firstName={firstNameFrom(session.profile.fullName)}
      next={upcoming[0] ?? null}
      loadError={appointmentsResult.error}
      recentWorkspaces={uniqueClientWorkspaces(appointmentsResult.appointments)}
      completed={completed}
    />
  );
}
