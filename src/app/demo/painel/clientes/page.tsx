import { Suspense } from "react";
import { DemoClients } from "@/components/demo/demo-lists";

export default function DemoClientsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando clientes…</p>}>
      <DemoClients />
    </Suspense>
  );
}
