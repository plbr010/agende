"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PublicBookingFlow, type PublicBookingRuntime } from "@/components/booking/public-booking-flow";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/components/demo/demo-provider";
import { demoPublicCatalog } from "@/lib/demo/catalog";
import { demoSlots } from "@/lib/demo/schedule";
import { DEMO_BOOK_HREF, DEMO_CLIENT_HREF, DEMO_PLANS_HREF, DEMO_TRIAL_HREF, demoAgendaHref } from "@/lib/demo/paths";
import type { PublicBookingConfirmation } from "@/lib/booking/queries";
import { formatDateInTimeZone } from "@/lib/time/timezone";

export function DemoBooking() {
  const demo = useDemo();
  const params = useSearchParams();
  const requested = params.get("servico");
  const catalog = useMemo(() => demoPublicCatalog(), []);
  const runtime = useMemo<PublicBookingRuntime>(() => ({
    profileHref: DEMO_CLIENT_HREF,
    photoUrl: () => null,
    fetchSlots: async (input) => ({
      slots: demoSlots({
        localDate: input.localDate,
        serviceId: input.serviceId,
        professionalMemberId: input.professionalMemberId,
        appointments: demo.appointments,
      }),
    }),
    confirm: (input) => demo.confirmBooking(input),
    successFooter: (confirmation) => <DemoSuccessFooter confirmation={confirmation} />,
  }), [demo]);
  const initialServiceId = catalog.services.some((service) => service.id === requested) ? requested : null;

  return (
    <PublicBookingFlow
      catalog={catalog}
      today={demo.today}
      prefill={{ fullName: "", phone: "", email: "" }}
      initialServiceId={initialServiceId}
      runtime={runtime}
    />
  );
}

function DemoSuccessFooter({ confirmation }: { confirmation: PublicBookingConfirmation }) {
  const date = formatDateInTimeZone(confirmation.startsAt, confirmation.timezone);
  return (
    <>
      <Button className="h-auto min-h-12 w-full rounded-full whitespace-normal text-center" render={<Link href={demoAgendaHref(date, confirmation.appointmentId)} />}>
        Veja como esse agendamento aparece para o profissional
      </Button>
      <Button variant="outline" className="h-12 rounded-full" render={<Link href={DEMO_BOOK_HREF} />}>
        Agendar outro horário
      </Button>
      <Button variant="rose" className="h-auto min-h-12 w-full rounded-full whitespace-normal text-center" render={<Link href={DEMO_TRIAL_HREF} />}>
        Começar meu teste gratuito
      </Button>
      <Button variant="outline" className="h-12 rounded-full" render={<Link href={DEMO_PLANS_HREF} />}>
        Conhecer os planos
      </Button>
    </>
  );
}
