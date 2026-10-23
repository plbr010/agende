import { Suspense } from "react";
import { DemoBooking } from "@/components/demo/demo-booking";

export default function DemoBookingPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Carregando o agendamento…</p>}>
      <DemoBooking />
    </Suspense>
  );
}
