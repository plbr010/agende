import { Suspense } from "react";
import { DemoHome } from "@/components/demo/demo-home";

export default function DemoPanelPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando o painel…</p>}>
      <DemoHome />
    </Suspense>
  );
}
