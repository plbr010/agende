import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { formatCentsToReais } from "@/lib/validation/money";
import type { PublicWorkspaceProfile } from "@/lib/workspace/public";
import { Button } from "@/components/ui/button";

function servicePriceLabel(min: number, max: number) {
  if (min !== max) {
    return `a partir de ${formatCentsToReais(min)}`;
  }
  return formatCentsToReais(min);
}

export function PublicWorkspacePage({ profile }: { profile: PublicWorkspaceProfile }) {
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const initial = profile.name.slice(0, 1).toUpperCase();

  return (
    <div className="agende-bloom min-h-full">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4">
          <BrandLogo size="sm" />
          <span className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Página pública</span>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-8">
        <section className="overflow-hidden rounded-[2rem] bg-card ring-1 ring-border">
          <div className="h-28 bg-gradient-to-br from-secondary via-accent/40 to-primary/20" />
          <div className="grid gap-4 px-5 pb-6 sm:px-8">
            <div className="-mt-10 flex items-end gap-4">
              {profile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logoUrl}
                  alt={`Logo de ${profile.name}`}
                  className="size-20 rounded-3xl object-cover ring-4 ring-card"
                />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-3xl bg-secondary font-serif text-3xl text-primary ring-4 ring-card">
                  {initial}
                </div>
              )}
              <div className="min-w-0 pb-1">
                <h1 className="font-serif text-3xl leading-tight sm:text-4xl">{profile.name}</h1>
                {location ? <p className="text-sm text-muted-foreground">{location}</p> : null}
              </div>
            </div>
            {profile.description ? (
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">{profile.description}</p>
            ) : (
              <p className="text-muted-foreground">Um espaço de beleza no Agendê.</p>
            )}
            {profile.instagram ? (
              <a
                href={`https://instagram.com/${profile.instagram}`}
                className="w-fit text-sm text-foreground underline underline-offset-4"
                target="_blank"
                rel="noreferrer"
              >
                @{profile.instagram}
              </a>
            ) : null}
          </div>
        </section>

        <section className="rounded-[2rem] bg-secondary/50 px-5 py-6 text-center ring-1 ring-border sm:px-8">
          <p className="text-xs tracking-[0.18em] text-primary uppercase">Agenda</p>
          <h2 className="mt-2 font-serif text-3xl">Escolha um horário</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Serviço, profissional, dia e horário — sem criar conta para a primeira reserva.
          </p>
          <Button className="mt-5 h-12 rounded-full px-6" render={<Link href={`/p/${profile.slug}/agendar`} />}>
            Agendar horário
          </Button>
        </section>

        <section className="grid gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Serviços</p>
            <h2 className="font-serif text-3xl">O que oferecemos</h2>
          </div>
          {profile.services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Os serviços públicos aparecem aqui quando estiverem ativos.</p>
          ) : (
            <div className="grid gap-3">
              {profile.services.map((service) => (
                <article key={service.name} className="rounded-3xl bg-card p-5 ring-1 ring-border">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-medium">{service.name}</h3>
                      {service.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
                      ) : null}
                    </div>
                    <p className="text-sm whitespace-nowrap">{servicePriceLabel(service.min_price_cents, service.max_price_cents)}</p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{service.duration_minutes} minutos</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Equipe</p>
            <h2 className="font-serif text-3xl">Quem atende</h2>
          </div>
          {profile.professionals.length === 0 ? (
            <p className="text-sm text-muted-foreground">As profissionais com agenda ligada aparecem aqui.</p>
          ) : (
            <div className="grid gap-3">
              {profile.professionals.map((person) => (
                <article key={person.display_name} className="rounded-3xl bg-card p-5 ring-1 ring-border">
                  <h3 className="font-serif text-2xl">{person.display_name}</h3>
                  {person.bio ? <p className="mt-1 text-sm text-muted-foreground">{person.bio}</p> : null}
                  {person.services.length > 0 ? (
                    <p className="mt-3 text-sm">{person.services.join(" · ")}</p>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">Serviços em breve</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <footer className="mx-auto w-full max-w-3xl px-4 pb-10 text-center text-sm text-muted-foreground">
        Página pública do estabelecimento.{" "}
        <Link href="/" className="underline underline-offset-4">
          Conheça o Agendê
        </Link>
      </footer>
    </div>
  );
}
