"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DEMO_BOOK_HREF, DEMO_CLIENT_HREF, DEMO_PANEL_HREF, DEMO_PLANS_HREF, DEMO_TRIAL_HREF, demoAgendaHref } from "@/lib/demo/paths";
import { useDemo } from "@/components/demo/demo-provider";

const STEPS = [
  { label: "Escolher um serviço", href: DEMO_CLIENT_HREF },
  { label: "Agendar um horário", href: DEMO_BOOK_HREF },
  { label: "Ver na agenda", href: "" },
  { label: "Explorar a gestão", href: DEMO_PANEL_HREF },
  { label: "Começar a usar", href: DEMO_TRIAL_HREF },
] as const;

export function DemoChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const demo = useDemo();
  const hasBooking = demo.session.visitorAppointments.length > 0;
  const highlighted = demo.appointments.find((item) => item.id === demo.session.highlightId);
  const agendaHref = highlighted ? demoAgendaHref(highlighted.localDate, highlighted.id) : "/demo/painel/agenda";
  const current = suggestedStep(pathname, hasBooking);

  return (
    <div className="min-h-full bg-background">
      <div className="border-b border-[#eadfd8] bg-[var(--cream)]">
        <div className="mx-auto flex w-full max-w-[76rem] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
          <p className="min-w-0 flex-1 leading-5 text-wine-deep">Demonstração · dados fictícios · nada é salvo no Agendê</p>
          <Link href={DEMO_TRIAL_HREF} className="inline-flex min-h-11 items-center font-medium text-wine-deep underline-offset-4 hover:underline">Teste grátis</Link>
          <Link href={DEMO_PLANS_HREF} className="inline-flex min-h-11 items-center font-medium text-wine-deep underline-offset-4 hover:underline">Planos</Link>
          <button type="button" className="inline-flex min-h-11 items-center text-wine-deep underline-offset-4 hover:underline" onClick={demo.reset}>
            Reiniciar
          </button>
          {demo.session.guideDismissed ? (
            <button type="button" className="inline-flex min-h-11 items-center text-wine-deep underline-offset-4 hover:underline" onClick={demo.showGuide}>
              Guia
            </button>
          ) : null}
        </div>
      </div>
      {demo.session.guideDismissed ? null : (
        <section className="overflow-x-clip border-b border-[#f0e4de] bg-white/80" aria-label="Guia da demonstração">
          <div className="mx-auto flex w-full max-w-[76rem] items-center gap-2 px-3 py-2">
            <p className="sr-only">Caminho sugerido</p>
            <ol className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
              {STEPS.map((step, index) => {
                const href = index === 2 ? agendaHref : step.href;
                const active = index === current;
                return (
                  <li key={step.label} className="shrink-0">
                    <Link
                      href={href}
                      aria-current={active ? "step" : undefined}
                      className={`flex h-11 items-center rounded-full px-3 text-sm whitespace-nowrap ${active ? "bg-metric-blush font-medium text-wine-deep ring-1 ring-[#e7b7c4]" : "bg-secondary/50 text-muted-foreground"}`}
                    >
                      <span className="mr-2 font-serif text-base text-wine-deep">{index + 1}</span>
                      {step.label}
                    </Link>
                  </li>
                );
              })}
            </ol>
            <button type="button" className="inline-flex h-11 shrink-0 items-center px-1 text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={demo.dismissGuide}>
              Pular
            </button>
          </div>
        </section>
      )}
      {children}
    </div>
  );
}

function suggestedStep(pathname: string, hasBooking: boolean): number {
  if (pathname.startsWith("/demo/painel/agenda")) return 2;
  if (pathname.startsWith("/demo/painel")) return 3;
  if (pathname.startsWith(DEMO_BOOK_HREF)) return hasBooking ? 2 : 1;
  if (pathname.startsWith(DEMO_CLIENT_HREF)) return 0;
  return 0;
}
