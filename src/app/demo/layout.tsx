import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DemoChrome } from "@/components/demo/demo-chrome";
import { DemoProvider } from "@/components/demo/demo-provider";

export const metadata: Metadata = {
  title: "Conheça o Agendê na prática",
  description: "Veja como seus clientes agendam horários e como você organiza seu negócio em um só lugar.",
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <DemoProvider>
      <DemoChrome>{children}</DemoChrome>
    </DemoProvider>
  );
}
