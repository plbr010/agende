import Link from "next/link";
import { FloralSprig, FloralWreath } from "@/components/brand/floral";
import { Button } from "@/components/ui/button";

export function IdentityPreview({
  name,
  description,
  logoUrl,
  coverUrl,
  publicHref,
}: {
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  publicHref: string;
}) {
  const initial = name.slice(0, 1).toUpperCase() || "A";

  return (
    <section aria-label="Prévia da página pública" className="overflow-hidden rounded-[2rem] bg-white ring-1 ring-[#f0e4de]">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 sm:px-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--rose-ink)] uppercase">Prévia</p>
          <h2 className="mt-1 font-serif text-3xl text-wine-deep">Como as clientes veem</h2>
        </div>
        <Button variant="outline" className="h-11 rounded-full" render={<Link href={publicHref} />}>
          Abrir página pública
        </Button>
      </div>
      <p className="px-5 pt-2 text-sm leading-6 text-muted-foreground sm:px-6">
        Esta prévia mostra o que já está publicado. Salve o texto, a logo ou a capa para atualizar.
      </p>
      <div className="p-4 sm:p-6">
        <div className="overflow-hidden rounded-[1.6rem] ring-1 ring-[#f0e4de]">
          {coverUrl ? (
            <div className="relative h-40 sm:h-52">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt={`Capa publicada de ${name}`} className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" />
            </div>
          ) : (
            <div className="relative h-40 overflow-hidden bg-gradient-to-br from-[#f8e4df] via-[#fbf4ee] to-[#e8b4a0]/80 sm:h-52">
              <FloralWreath className="pointer-events-none absolute -top-8 -right-6 h-40 w-40 opacity-80" />
              <FloralSprig className="pointer-events-none absolute right-4 bottom-2 h-16 w-10 opacity-80" />
              <p className="relative max-w-xs p-5 font-serif text-2xl text-wine-deep">Foto ainda não publicada</p>
            </div>
          )}
          <div className="px-4 pb-5 sm:px-5">
            <div className="relative z-10 -mt-8">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={`Logo publicada de ${name}`}
                  className="size-16 rounded-[1.2rem] object-cover shadow-[0_16px_40px_-24px_rgb(92_26_46/0.65)] ring-4 ring-white sm:size-20"
                />
              ) : (
                <div
                  className="flex size-16 items-center justify-center rounded-[1.2rem] bg-wine-deep font-serif text-3xl text-[var(--cream)] shadow-[0_16px_40px_-24px_rgb(92_26_46/0.65)] ring-4 ring-white sm:size-20"
                  role="img"
                  aria-label={`Logo de ${name} ainda não publicada`}
                >
                  {initial}
                </div>
              )}
            </div>
            <h3 className="mt-3 font-serif text-3xl text-wine-deep">{name}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/90">
              {description?.trim() ? description : "Este salão ainda não publicou uma descrição."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
