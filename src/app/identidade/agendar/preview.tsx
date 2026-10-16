"use client";

import { useState } from "react";
import { AppointmentDetailDialog } from "@/components/agenda/agenda-board";
import { PublicBookingFlow } from "@/components/booking/public-booking-flow";
import type { AgendaAppointment } from "@/lib/agenda/queries";
import type { AppointmentStatus } from "@/lib/agenda/status";
import { Button } from "@/components/ui/button";

const serviceId = "11111111-1111-4111-8111-111111111111";
const professionalId = "22222222-2222-4222-8222-222222222222";
const appointmentId = "33333333-3333-4333-8333-333333333333";

const appointmentBase: AgendaAppointment = {
  id: appointmentId,
  workspaceId: "44444444-4444-4444-8444-444444444444",
  clientId: "55555555-5555-4555-8555-555555555555",
  clientName: "Maria Clara Souza",
  clientPhone: "+55 (32) 99999-9999",
  professionalMemberId: professionalId,
  professionalName: "Ana Lima",
  serviceId,
  serviceName: "Corte e escova",
  startsAt: "2026-10-20T17:30:00.000Z",
  endsAt: "2026-10-20T18:30:00.000Z",
  status: "confirmed",
  priceCents: 12000,
  durationMinutes: 60,
  notes: null,
  localDate: "2026-10-20",
  localStart: "14:30",
  localEnd: "15:30",
};

const statuses: AppointmentStatus[] = ["scheduled", "confirmed", "cancelled"];

export function BookingAuthPreview() {
  const [status, setStatus] = useState<AppointmentStatus>("confirmed");
  const [open, setOpen] = useState(true);

  return (
    <div className="grid gap-10 bg-[var(--cream)] pb-16">
      <p className="bg-wine-deep px-4 py-3 text-center text-sm text-white">
        Prévia visual para aprovação — dados ilustrativos, não é um salão real e não entra no índice de busca.
      </p>
      <section className="mx-auto grid w-full max-w-lg gap-4 px-4">
        <h2 className="font-serif text-3xl text-wine-deep">Detalhe do agendamento</h2>
        <div className="flex flex-wrap gap-2">
          {statuses.map((item) => (
            <Button key={item} type="button" variant={item === status ? "default" : "outline"} className="h-11" onClick={() => { setStatus(item); setOpen(true); }}>
              {item === "scheduled" ? "Pendente" : item === "confirmed" ? "Confirmado" : "Cancelado"}
            </Button>
          ))}
        </div>
        <AppointmentDetailDialog
          workspaceName="Studio Beleza"
          timezone="America/Sao_Paulo"
          appointment={{ ...appointmentBase, status }}
          open={open}
          onOpenChange={setOpen}
          professionals={[]}
          services={[]}
          role="owner"
          currentMemberId={professionalId}
        />
      </section>
      <section className="border-t border-border/70">
        <PublicBookingFlow
          catalog={{
            name: "Studio Beleza",
            slug: "studio-beleza",
            timezone: "America/Sao_Paulo",
            logoUrl: null,
            horizonDays: 14,
            minLeadMinutes: 60,
            services: [
              {
                id: serviceId,
                name: "Corte e escova",
                description: "Corte com escova.",
                durationMinutes: 60,
                priceCents: 12000,
                minPriceCents: 12000,
                maxPriceCents: 12000,
              },
            ],
            professionals: [
              {
                id: professionalId,
                displayName: "Ana Lima",
                bio: null,
                photoUrl: null,
                serviceIds: [serviceId],
                offerings: [{ serviceId, priceCents: 12000, durationMinutes: 60 }],
              },
            ],
          }}
          prefill={{ fullName: "Maria Clara Souza", phone: "(32) 99999-9999", email: "maria@example.com" }}
          today="2026-10-16"
          authenticated={false}
          initialDraft={{
            slug: "studio-beleza",
            serviceId,
            professionalMemberId: professionalId,
            localDate: "2026-10-20",
            startsAt: "2026-10-20T17:30:00.000Z",
          }}
        />
      </section>
    </div>
  );
}
