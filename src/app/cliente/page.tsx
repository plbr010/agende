import Link from "next/link";
import { CalendarCheck2, CalendarDays, ChevronRight, Clock3, Heart, Sparkles, Star } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceFinder } from "@/components/client/workspace-finder";
import { loadMyAppointmentsResult } from "@/lib/booking/queries";
import { partitionClientAppointments, uniqueClientWorkspaces } from "@/lib/booking/validation";
import { loadReviewsResult } from "@/lib/reviews/queries";
import { formatDateTimeInTimeZone } from "@/lib/time/timezone";

export default async function ClientePage() {
  const session = await requireConfirmedSession("/cliente");
  const [appointmentsResult, { reviews, schemaReady }] = await Promise.all([
    loadMyAppointmentsResult(),
    loadReviewsResult(),
  ]);
  const appointments = appointmentsResult.appointments;
  const { upcoming, past } = partitionClientAppointments(appointments);
  const next = upcoming[0];
  const firstName = session.profile.fullName.split(/\s+/)[0] || "cliente";
  const knownWorkspaces = uniqueClientWorkspaces(appointments);
  const metrics = [
    { icon: CalendarCheck2, label: "Próximos", value: upcoming.length, hint: "horários à frente" },
    { icon: Clock3, label: "Histórico", value: past.length, hint: "atendimentos anteriores" },
    {
      icon: Star,
      label: "Avaliações",
      value: schemaReady ? reviews.length : "—",
      hint: schemaReady ? "notas enviadas" : "disponíveis após o atendimento",
    },
  ];

  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] bg-primary px-5 py-8 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -top-20 -right-12 size-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary-foreground/70 uppercase"><Sparkles className="size-3.5" /> Área da cliente</p>
            <h1 className="mt-3 text-4xl leading-none font-semibold tracking-tight sm:text-5xl">Seu momento de cuidado, {firstName}.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-primary-foreground/75 sm:text-base">Acompanhe seus horários e volte aos lugares que fazem você se sentir bem.</p>
          </div>
          <Button variant="secondary" size="lg" className="h-11 w-fit rounded-full px-5" render={<Link href="/cliente/agendamentos" />}>
            <CalendarDays className="size-4" /> Meus agendamentos
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {metrics.map(({ icon: MetricIcon, label, value, hint }) => (
            <Card key={label} className="rounded-3xl border-border/70 bg-card/85 p-1 shadow-sm">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary"><MetricIcon className="size-4" /></div>
                <div><p className="text-sm text-muted-foreground">{label}</p><p className="font-serif text-3xl leading-none">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div>
              </CardContent>
            </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Seu próximo cuidado</CardTitle>
            <CardDescription>O compromisso mais próximo na sua agenda.</CardDescription>
          </CardHeader>
          <CardContent>
            {appointmentsResult.error ? (
              <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
                {appointmentsResult.error}
              </p>
            ) : next ? (
              <Link href="/cliente/agendamentos" className="group flex items-center gap-4 rounded-2xl bg-secondary/60 p-4 transition-colors hover:bg-secondary">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-background text-primary ring-1 ring-border"><CalendarDays className="size-5" /></div>
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{next.serviceName}</p><p className="truncate text-sm text-muted-foreground">{next.workspaceName} · {next.professionalName}</p><p className="mt-1 text-xs">{formatDateTimeInTimeZone(next.startsAt, next.timezone)}</p></div>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <div className="grid gap-4 rounded-2xl bg-secondary/45 px-4 py-6">
                <div className="grid place-items-center gap-3 text-center">
                  <Heart className="size-6 text-primary" />
                  <div>
                    <p className="font-medium">Nada marcado por enquanto</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Abra o link do estabelecimento para reservar. O Agendê não inventa salões na busca.
                    </p>
                  </div>
                </div>
                <WorkspaceFinder knownWorkspaces={knownWorkspaces} />
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
          <CardHeader><CardTitle className="text-xl">Também é profissional?</CardTitle><CardDescription>Use a mesma conta para cuidar do seu negócio.</CardDescription></CardHeader>
          <CardContent>
            {session.context.hasWorkspace ? (
              <Button variant="outline" className="h-11 w-full rounded-full" render={<Link href="/app" />}>Ir para área profissional</Button>
            ) : (
              <Button variant="outline" className="h-11 w-full rounded-full" render={<Link href="/onboarding" />}>Criar meu espaço profissional</Button>
            )}
            <p className="mt-4 text-center text-xs text-muted-foreground">Sua área de cliente continua gratuita.</p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
