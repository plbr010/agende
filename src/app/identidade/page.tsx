import type { Metadata } from "next";
import { ProfessionalDashboard } from "@/components/app/professional-dashboard";
import { AppShell } from "@/components/app/app-shell";
import { BrandLogo } from "@/components/brand/logo";
import { FloralCorner, FloralSprig } from "@/components/brand/floral";
import { Button } from "@/components/ui/button";
import { buildMonthGrid } from "@/lib/dashboard/summary";

export const metadata: Metadata = {
  title: "Prévia da identidade",
  robots: { index: false, follow: false },
};

const SAMPLE_VISITS = [
  { id: "1", clientName: "Ana Silva", serviceName: "Manicure e Pedicure", professionalName: "Camila", localDate: "2026-05-12", localStart: "09:00", status: "confirmed" as const },
  { id: "2", clientName: "Beatriz Lima", serviceName: "Hidratação", professionalName: "Camila", localDate: "2026-05-12", localStart: "10:30", status: "confirmed" as const },
  { id: "3", clientName: "Carla Mendes", serviceName: "Escova", professionalName: "Juliana", localDate: "2026-05-12", localStart: "14:00", status: "confirmed" as const },
  { id: "4", clientName: "Juliana Costa", serviceName: "Manicure", professionalName: "Camila", localDate: "2026-05-12", localStart: "15:30", status: "scheduled" as const },
];

export default function IdentidadePreviewPage() {
  const month = "2026-05";
  const today = "2026-05-12";
  const occupied = new Set(["2026-05-12", "2026-05-13", "2026-05-16"]);

  return (
    <div className="grid gap-10 bg-[var(--cream)] pb-16">
      <p className="bg-wine-deep px-4 py-3 text-center text-sm text-white">
        Prévia visual para aprovação — dados ilustrativos, não é um salão real e não entra no índice de busca.{" "}
        <a href="/identidade/cliente" className="underline underline-offset-4">
          Ver a área da cliente
        </a>
        {" · "}
        <a href="/identidade/salao" className="underline underline-offset-4">
          Ver a página do salão
        </a>
      </p>

      <AppShell workspaceName="Studio Beleza" workspaceSlug="studio-beleza" userName="Ana Carolina" roleLabel="Proprietária" role="owner">
        <ProfessionalDashboard
          firstName="Ana Carolina"
          salonName="Studio Beleza"
          todayLabel="Seg, 12 de maio"
          clientError={false}
          metrics={[
            { label: "Agendamentos hoje", value: "8", hint: "Sem cancelados", href: "/app/agenda", tone: "blush", delta: 20 },
            { label: "Receita do dia", value: "R$ 2.480,00", hint: "Soma dos horários, sem faltas", href: "/app/financeiro", tone: "sand", delta: 15 },
            { label: "Clientes ativos", value: "124", hint: "Cadastrados no salão", href: "/app/clientes", tone: "ivory", delta: 8 },
            { label: "Avaliação média", value: "4,9", hint: "12 avaliações recebidas", href: "/app/avaliacoes", tone: "lilac", delta: null, stars: { filled: 5, label: "Nota 4,9 de 5" } },
          ]}
          todayVisits={SAMPLE_VISITS}
          showProfessional={false}
          cancelledToday={0}
          upcoming={SAMPLE_VISITS.slice(0, 3).map((visit, index) => ({ ...visit, id: `u${index}`, localStart: ["09:00", "10:30", "14:00"][index] ?? visit.localStart }))}
          calendar={{
            title: "Maio 2026",
            prevHref: "/identidade",
            nextHref: "/identidade",
            weeks: buildMonthGrid(month, today, occupied),
          }}
          setup={null}
          plan={{
            planLabel: "Equipe",
            statusLabel: "Em teste",
            trialStarted: "05/05/2026",
            trialEnds: "12/05/2026",
            trialDaysRemaining: 5,
            roleLabel: "Proprietária",
            publicPath: "/p/studio-beleza",
            hasClientProfile: true,
          }}
          primaryAction={{ href: "/app/agenda?novo=1", label: "Novo horário" }}
        />
      </AppShell>

      <section className="mx-auto grid w-full max-w-md gap-4 px-4" aria-label="Prévia do agendamento no celular">
        <h2 className="text-center text-sm font-medium text-muted-foreground">Tela de agendamento mobile (prévia)</h2>
        <div className="overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_50px_-28px_rgb(92_26_46/0.5)] ring-1 ring-[#f0e4de]">
          <div className="flex h-14 items-center justify-between px-4">
            <BrandLogo size="sm" href="/identidade" />
            <span className="text-xs text-muted-foreground">9:41</span>
          </div>
          <div className="relative overflow-hidden px-5 pb-8 pt-2">
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-[0.16em] text-[var(--rose-ink)] uppercase">Agendamento</p>
                <h3 className="mt-2 font-serif text-3xl leading-tight text-wine-deep">Escolha o profissional</h3>
              </div>
              <FloralSprig className="h-16 w-12 shrink-0" />
            </div>
            <FloralCorner className="pointer-events-none absolute -right-6 bottom-0 h-20 w-28 opacity-80" />
            <div className="relative z-10 mt-4 grid gap-3">
              {["Camila Santos", "Juliana Costa", "Larissa Ferreira"].map((name) => (
                <div key={name} className="flex items-center gap-3 rounded-[1.25rem] bg-[var(--cream)] p-3 ring-1 ring-[#f0e4de]">
                  <span className="grid size-12 place-items-center rounded-full bg-metric-blush font-serif text-wine-deep">
                    {name.split(" ").map((part) => part[0]).join("")}
                  </span>
                  <span>
                    <span className="block font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground">Especialista em unhas</span>
                  </span>
                </div>
              ))}
              <Button variant="rose" className="mt-2 h-12 rounded-full">Continuar</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
