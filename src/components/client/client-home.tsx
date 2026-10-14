import Link from "next/link";
import { CalendarDays, ChevronRight, Compass, Heart, RefreshCcw, Sparkles } from "lucide-react";
import { FloralBranch, FloralCorner } from "@/components/brand/floral";
import { FavoritesPanel } from "@/components/client/favorites-panel";
import { Button } from "@/components/ui/button";
import type { FavoritesView } from "@/lib/client/favorites";
import type { MyAppointment } from "@/lib/booking/queries";
import { bookAgainPath } from "@/lib/booking/validation";
import { formatDateTimeInTimeZone } from "@/lib/time/timezone";
import { formatCentsToReais } from "@/lib/validation/money";
import { publicProfilePath } from "@/lib/workspace/slug";

export function ClientHome({
  firstName,
  next,
  loadError,
  recentWorkspaces,
  completed,
  favorites,
}: {
  firstName: string;
  next: MyAppointment | null;
  loadError: string | null;
  recentWorkspaces: { slug: string; name: string }[];
  completed: MyAppointment[];
  favorites: FavoritesView;
}) {
  const greeting = firstName ? `Olá, ${firstName}!` : "Olá!";

  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] bg-wine-deep px-5 py-8 text-white shadow-[0_24px_48px_-32px_rgb(92_26_46/0.7)] sm:px-8 sm:py-10">
        <FloralCorner className="pointer-events-none absolute -right-4 -top-6 h-36 w-44 opacity-70" />
        <FloralBranch className="pointer-events-none absolute -bottom-16 -left-8 h-44 w-36 opacity-50" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">
              <Sparkles className="size-3.5" aria-hidden="true" /> Seu espaço
            </p>
            <h1 className="mt-3 font-serif text-4xl leading-none tracking-tight sm:text-5xl">{greeting}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/80 sm:text-base">
              Seu próximo momento de beleza começa aqui.
            </p>
          </div>
          <Button
            variant="secondary"
            size="lg"
            className="h-12 w-fit rounded-full bg-white px-5 text-wine-deep hover:bg-metric-blush"
            render={<Link href="/cliente/descobrir" />}
          >
            <Compass className="size-4" /> Encontrar um salão
          </Button>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-wine-deep uppercase">Próximo horário</p>
            <h2 className="mt-1 font-serif text-2xl text-wine-deep sm:text-3xl">O que vem pela frente</h2>
          </div>
          <Link href="/cliente/agendamentos" className="text-sm font-medium text-wine-deep underline-offset-4 hover:underline">
            Ver agenda
          </Link>
        </div>
        {loadError ? (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : next ? (
          <Link
            href="/cliente/agendamentos"
            className="group relative overflow-hidden rounded-[1.8rem] bg-white p-5 shadow-[0_18px_40px_-32px_rgb(92_26_46/0.45)] ring-1 ring-[#f0e4de] sm:p-6"
          >
            <FloralCorner className="pointer-events-none absolute right-0 top-0 h-24 w-32 opacity-70" />
            <div className="relative flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-metric-blush text-wine-deep">
                <CalendarDays className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-[0.16em] text-[var(--rose-ink)] uppercase">{next.workspaceName}</p>
                <p className="mt-1 font-serif text-2xl text-wine-deep">{next.serviceName}</p>
                <p className="mt-1 text-sm text-muted-foreground">com {next.professionalName}</p>
                <p className="mt-3 text-sm font-medium">{formatDateTimeInTimeZone(next.startsAt, next.timezone)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{formatCentsToReais(next.priceCents)}</p>
              </div>
              <ChevronRight className="mt-2 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </div>
          </Link>
        ) : (
          <div className="relative overflow-hidden rounded-[1.8rem] bg-white p-6 ring-1 ring-[#f0e4de] sm:p-8">
            <FloralBranch className="pointer-events-none absolute -right-10 -bottom-12 h-40 w-32 opacity-60" />
            <div className="relative grid max-w-lg gap-4">
              <span className="grid size-12 place-items-center rounded-full bg-metric-blush text-wine-deep">
                <CalendarDays className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-serif text-2xl text-wine-deep">Nada marcado por enquanto</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Quando você confirmar um horário, ele aparece aqui. Até lá, explore salões no seu ritmo — sem criar conta só para olhar.
                </p>
              </div>
              <Button className="h-11 w-fit rounded-full" render={<Link href="/cliente/descobrir" />}>
                Explorar estabelecimentos
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-wine-deep uppercase">Seus favoritos</p>
          <h2 className="mt-1 font-serif text-2xl text-wine-deep sm:text-3xl">Salões para voltar</h2>
        </div>
        <FavoritesPanel compact favorites={favorites} />
        <Link href="/cliente/favoritos" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-wine-deep underline-offset-4 hover:underline">
          <Heart className="size-4" aria-hidden="true" /> Ver detalhes
        </Link>
      </section>

      <section className="grid gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-wine-deep uppercase">Agende novamente</p>
          <h2 className="mt-1 font-serif text-2xl text-wine-deep sm:text-3xl">Onde você já esteve</h2>
        </div>
        {recentWorkspaces.length === 0 && completed.length === 0 ? (
          <div className="rounded-[1.8rem] bg-metric-sand/70 p-6 ring-1 ring-[#f0e4de]">
            <p className="font-medium text-wine-deep">Ainda não há um histórico para repetir</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Depois do primeiro atendimento, você poderá marcar o mesmo serviço em um horário novo.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {(completed.length > 0
              ? completed.slice(0, 4).map((item) => ({
                  key: item.id,
                  title: item.serviceName,
                  workspaceName: item.workspaceName,
                  slug: item.slug,
                  serviceId: item.serviceId,
                }))
              : recentWorkspaces.map((workspace) => ({
                  key: workspace.slug,
                  title: workspace.name,
                  workspaceName: workspace.name,
                  slug: workspace.slug,
                  serviceId: undefined as string | undefined,
                }))
            ).map((item) => (
              <li key={item.key}>
                <article className="flex h-full flex-col justify-between rounded-[1.6rem] bg-white p-5 ring-1 ring-[#f0e4de]">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.16em] text-[var(--rose-ink)] uppercase">{item.workspaceName}</p>
                    <p className="mt-2 font-serif text-xl text-wine-deep">{item.title}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button className="h-11 rounded-full" render={<Link href={bookAgainPath(item)} />}>
                      <RefreshCcw className="size-4" /> Agendar novamente
                    </Button>
                    <Button variant="outline" className="h-11 rounded-full" render={<Link href={publicProfilePath(item.slug)} />}>
                      Ver o salão
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="relative overflow-hidden rounded-[1.8rem] bg-metric-blush/70 p-6 ring-1 ring-[#f0e4de] sm:p-8">
        <FloralCorner className="pointer-events-none absolute -left-6 -bottom-8 h-28 w-36 opacity-80" />
        <div className="relative grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-wine-deep uppercase">Explore perto de você</p>
            <h2 className="mt-1 font-serif text-2xl text-wine-deep">Quando você quiser, no lugar que escolher</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              A busca por cidade, nome ou localização só acontece com o seu consentimento, na área Explorar. Não usamos a cidade do seu cadastro para inventar resultados.
            </p>
          </div>
          <Button className="h-12 w-fit rounded-full" render={<Link href="/cliente/descobrir" />}>
            <Compass className="size-4" /> Abrir Explorar
          </Button>
        </div>
      </section>
    </>
  );
}
