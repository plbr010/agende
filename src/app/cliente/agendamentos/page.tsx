import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { ClientAppointments } from "@/components/booking/client-appointments";
import { loadMyAppointmentsResult } from "@/lib/booking/queries";
import { PageHeader } from "@/components/app/page-header";
import { firstNameFrom } from "@/lib/client/profile";

export default async function ClienteAgendamentosPage() {
  const session = await requireConfirmedSession("/cliente/agendamentos");
  const { appointments, error } = await loadMyAppointmentsResult();
  const firstName = firstNameFrom(session.profile.fullName);

  return (
    <>
      <PageHeader
        eyebrow="Sua agenda"
        title="Meus agendamentos"
        description={
          firstName
            ? `Olá, ${firstName}. Próximos horários, histórico e cancelados — só o que é da sua conta.`
            : "Próximos horários, histórico e cancelados — só o que é da sua conta."
        }
        icon={CalendarDays}
        actions={
          <Link href="/cliente/descobrir" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Encontrar um salão
          </Link>
        }
      />
      <ClientAppointments initial={appointments} loadError={error} />
    </>
  );
}
