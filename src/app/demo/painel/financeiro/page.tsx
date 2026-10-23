import { Suspense } from "react";
import { DemoFinance } from "@/components/demo/demo-money";

export default function DemoFinancePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando o financeiro…</p>}>
      <DemoFinance />
    </Suspense>
  );
}
