import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { ClientAppointments } from "@/components/booking/client-appointments";
import { loadMyAppointments } from "@/lib/booking/queries";
import { PageHeader } from "@/components/app/page-header";

export default async function ClienteAgendamentosPage() {
  const session = await requireConfirmedSession("/cliente/agendamentos");
  const appointments = await loadMyAppointments();

  return (
    <>
      <PageHeader
        eyebrow="Sua agenda"
        title="Meus agendamentos"
        description={`Olá, ${session.profile.fullName}. Acompanhe horários futuros, histórico e cancelamentos em um só lugar.`}
        icon={CalendarDays}
        actions={<Link href="/cliente" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Voltar ao início</Link>}
      />
      <ClientAppointments initial={appointments} />
    </>
  );
}
