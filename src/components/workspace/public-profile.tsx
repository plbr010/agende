import Link from "next/link";
import { Clock3, MapPin, Star } from "lucide-react";
import { FloralSprig, FloralWreath } from "@/components/brand/floral";
import { BrandLogo, BrandMark } from "@/components/brand/logo";
import { FavoriteButton } from "@/components/client/favorite-button";
import { PersonMark } from "@/components/people/person-mark";
import { Button } from "@/components/ui/button";
import { formatRatingPt } from "@/lib/dashboard/summary";
import { formatCentsToReais } from "@/lib/validation/money";
import { bookablePublicServices, type PublicWorkspaceProfile } from "@/lib/workspace/public";

function servicePriceLabel(min: number, max: number) {
  if (min !== max) {
    return `a partir de ${formatCentsToReais(min)}`;
  }
  return formatCentsToReais(min);
}

function serviceBookingHref(slug: string, serviceId: string | null) {
  if (!serviceId) {
    return `/p/${slug}/agendar`;
  }
  return `/p/${slug}/agendar?servico=${encodeURIComponent(serviceId)}`;
}

function ratingLabel(count: number) {
  return count === 1 ? "1 avaliação" : `${count} avaliações`;
}

export function PublicWorkspacePage({
  profile,
  bookingOpen = true,
  favorite = null,
}: {
  profile: PublicWorkspaceProfile;
  bookingOpen?: boolean;
  favorite?: { workspaceId: string | null; saved: boolean } | null;
}) {
  const locality = [profile.city, profile.state].filter(Boolean).join(" · ");
  const initial = profile.name.slice(0, 1).toUpperCase();
  const bookingHref = `/p/${profile.slug}/agendar`;
  const services = bookablePublicServices(profile);
  const showRating = profile.averageRating !== null && profile.reviewCount !== null;

  return (
    <div className="agende-bloom relative min-h-full overflow-x-clip">
      <FloralSprig className="pointer-events-none absolute top-24 -left-6 h-40 w-24 opacity-70" />
      <header className="sticky top-0 z-30 border-b border-[#f0e4de] bg-[var(--cream)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <BrandLogo size="sm" />
          {bookingOpen ? (
            <Button size="sm" className="h-11 rounded-full px-5" render={<Link href={bookingHref} />}>
              Agendar
            </Button>
          ) : null}
        </div>
      </header>

      <main className={`mx-auto grid w-full max-w-5xl gap-8 px-4 py-6 sm:py-10 ${bookingOpen ? "pb-28 sm:pb-12" : "pb-12"}`}>
        <section className="agende-panel overflow-hidden rounded-[2rem] ring-1 ring-[#f0e4de]">
          {profile.coverUrl ? (
            <div className="relative h-56 sm:h-80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.coverUrl} alt={`Capa de ${profile.name}`} className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
          ) : (
            <div className="relative h-64 overflow-hidden bg-gradient-to-br from-[#f8e4df] via-[#fbf4ee] to-[#e8b4a0]/80 sm:h-80">
              <FloralWreath className="pointer-events-none absolute -top-10 -right-8 h-64 w-64 opacity-90 sm:-top-16 sm:-right-6 sm:h-80 sm:w-80" />
              <FloralSprig className="pointer-events-none absolute right-6 bottom-2 h-28 w-16 opacity-80 sm:right-16 sm:h-36" />
              <div className="relative flex h-full max-w-md flex-col items-start justify-start p-6 sm:p-8">
                <BrandMark size="md" />
                <p className="mt-4 font-serif text-2xl text-wine-deep sm:text-3xl">Foto ainda não publicada</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  A capa do espaço aparece aqui quando o salão publicar uma imagem.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-5 px-5 pt-0 pb-6 sm:px-8 sm:pb-8">
            <div className="relative z-10 -mt-12 sm:-mt-16">
              {profile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logoUrl}
                  alt={`Logo de ${profile.name}`}
                  className="size-24 rounded-[1.6rem] object-cover shadow-[0_16px_40px_-24px_rgb(92_26_46/0.65)] ring-4 ring-[var(--cream)] sm:size-28"
                />
              ) : (
                <div
                  className="flex size-24 items-center justify-center rounded-[1.6rem] bg-wine-deep font-serif text-4xl text-[var(--cream)] shadow-[0_16px_40px_-24px_rgb(92_26_46/0.65)] ring-4 ring-white sm:size-28"
                  role="img"
                  aria-label={`Logo de ${profile.name} ainda não publicada`}
                >
                  {initial}
                </div>
              )}
            </div>

            <div className="grid gap-3">
              {locality ? (
                <p className="text-xs font-semibold tracking-[0.18em] text-[var(--rose-ink)] uppercase">{locality}</p>
              ) : null}
              <h1 className="font-serif text-4xl leading-[1.05] text-wine-deep sm:text-5xl">{profile.name}</h1>
              {profile.address ? (
                <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-wine-deep" aria-hidden="true" />
                  <span>{profile.address}</span>
                </p>
              ) : null}
              {showRating ? (
                <p className="inline-flex w-fit items-center gap-2 rounded-full bg-metric-blush px-3 py-1.5 text-sm text-wine-deep">
                  <Star className="size-4 fill-current" aria-hidden="true" />
                  <span className="sr-only">Avaliação média</span>
                  <span className="font-semibold">{formatRatingPt(profile.averageRating!)}</span>
                  <span className="text-muted-foreground">{ratingLabel(profile.reviewCount!)}</span>
                </p>
              ) : null}
              {profile.description ? (
                <p className="max-w-2xl text-base leading-7 text-foreground/90">{profile.description}</p>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">Este salão ainda não publicou uma descrição.</p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {profile.instagram ? (
                  <a
                    href={`https://instagram.com/${profile.instagram}`}
                    className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm text-wine-deep ring-1 ring-[#f0e4de] underline-offset-4 hover:bg-metric-blush"
                    target="_blank"
                    rel="noreferrer"
                  >
                    @{profile.instagram}
                  </a>
                ) : null}
                {favorite ? (
                  <FavoriteButton
                    slug={profile.slug}
                    workspaceId={favorite.workspaceId}
                    initialSaved={favorite.saved}
                    name={profile.name}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-10">
            {profile.photos.length > 0 ? (
              <section className="grid gap-4" aria-label="Fotos do estabelecimento">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[var(--rose-ink)] uppercase">Galeria</p>
                  <h2 className="mt-1 font-serif text-3xl text-wine-deep">Fotos</h2>
                </div>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {profile.photos.map((photo, index) => (
                    <li key={`${photo.url}-${index}`} className="overflow-hidden rounded-[1.25rem] ring-1 ring-[#f0e4de]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.alt ?? `${profile.name}, foto ${index + 1}`}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="grid gap-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[var(--rose-ink)] uppercase">Serviços</p>
                  <h2 className="mt-1 font-serif text-3xl text-wine-deep">O que oferecemos</h2>
                </div>
                {services.length > 0 ? (
                  <p className="text-sm text-muted-foreground">{services.length === 1 ? "1 serviço" : `${services.length} serviços`}</p>
                ) : null}
              </div>
              {services.length === 0 ? (
                <p className="agende-panel rounded-[1.5rem] p-5 text-sm leading-6 text-muted-foreground ring-1 ring-[#f0e4de]">
                  Este estabelecimento ainda não publicou serviços com agenda aberta. Volte mais tarde ou fale direto com o espaço.
                </p>
              ) : (
                <div className="grid gap-3">
                  {services.map((service, index) => (
                    <article
                      key={service.id ?? `${service.name}-${service.duration_minutes}-${index}`}
                      className="agende-panel grid gap-4 rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <h3 className="font-serif text-2xl text-wine-deep">{service.name}</h3>
                        {service.description ? (
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{service.description}</p>
                        ) : null}
                        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock3 className="size-3.5" aria-hidden="true" />
                          {service.duration_minutes} minutos
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                        <p className="font-serif text-2xl text-wine-deep">{servicePriceLabel(service.min_price_cents, service.max_price_cents)}</p>
                        {bookingOpen ? (
                          <Button
                            className="h-11 rounded-full px-5"
                            render={<Link href={serviceBookingHref(profile.slug, service.id)} />}
                          >
                            Agendar este serviço
                          </Button>
                        ) : (
                          <p className="text-sm text-muted-foreground">Reservas pausadas</p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="grid gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-[var(--rose-ink)] uppercase">Equipe</p>
                <h2 className="mt-1 font-serif text-3xl text-wine-deep">Quem atende</h2>
              </div>
              {profile.professionals.length === 0 ? (
                <p className="agende-panel rounded-[1.5rem] p-5 text-sm leading-6 text-muted-foreground ring-1 ring-[#f0e4de]">
                  As profissionais com agenda ligada aparecem aqui quando o espaço publicar a equipe.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {profile.professionals.map((person, index) => (
                    <article
                      key={person.id ?? `${person.display_name}-${index}`}
                      className="agende-panel rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de]"
                    >
                      <div className="flex items-center gap-3">
                        <PersonMark name={person.display_name} photoUrl={person.photoUrl} />
                        <h3 className="font-serif text-2xl text-wine-deep">{person.display_name}</h3>
                      </div>
                      {person.bio ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{person.bio}</p> : null}
                      {person.services.length > 0 ? (
                        <ul className="mt-4 flex flex-wrap gap-2">
                          {person.services.map((service) => (
                            <li key={service} className="rounded-full bg-metric-blush px-3 py-1 text-xs font-medium text-wine-deep">
                              {service}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">Nenhum serviço vinculado a esta profissional no perfil público.</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-24">
            <section className="agende-panel relative overflow-hidden rounded-[1.75rem] bg-white p-6 ring-1 ring-[#f0e4de]">
              <FloralSprig className="pointer-events-none absolute -top-2 -right-3 h-24 w-16 opacity-80" />
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--rose-ink)] uppercase">Agenda</p>
              <h2 className="relative mt-2 font-serif text-3xl text-wine-deep">
                {bookingOpen ? "Escolha um horário" : "Agenda temporariamente fechada"}
              </h2>
              <p className="relative mt-2 text-sm leading-6 text-muted-foreground">
                {bookingOpen
                  ? "Serviço, profissional, dia e horário — sem criar conta para a primeira reserva."
                  : "O perfil continua público, mas as reservas online estão pausadas até o estabelecimento reativar a assinatura."}
              </p>
              {bookingOpen ? (
                <Button className="relative mt-5 h-12 w-full rounded-full" render={<Link href={bookingHref} />}>
                  Agendar horário
                </Button>
              ) : null}
            </section>
          </aside>
        </div>
      </main>

      {bookingOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#f0e4de] bg-[var(--cream)]/95 px-4 py-3 backdrop-blur-md sm:hidden">
          <Button className="h-12 w-full rounded-full" render={<Link href={bookingHref} />}>
            Agendar horário
          </Button>
        </div>
      ) : null}

      <footer className={`mx-auto w-full max-w-5xl px-4 text-center text-sm text-muted-foreground ${bookingOpen ? "pb-28 sm:pb-10" : "pb-10"}`}>
        Página pública do estabelecimento.{" "}
        <Link href="/" className="text-wine-deep underline underline-offset-4">
          Conheça o Agendê
        </Link>
      </footer>
    </div>
  );
}
