import { Suspense } from "react";
import { DemoAgenda } from "@/components/demo/demo-agenda";

export default function DemoAgendaPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando a agenda…</p>}>
      <DemoAgenda />
    </Suspense>
  );
}
