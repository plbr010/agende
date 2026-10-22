import { Suspense } from "react";
import { DemoReports } from "@/components/demo/demo-money";

export default function DemoReportsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando os relatórios…</p>}>
      <DemoReports />
    </Suspense>
  );
}
