import { BrandLogo } from "@/components/brand/logo";
import { MarketingHashLink } from "@/components/marketing/hash-link";
import { FOOTER_LINKS } from "@/lib/marketing/content";

export function MarketingFooter() {
  return (
    <footer className="mt-auto border-t border-border/70 bg-background/70">
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8 px-4 py-10 sm:py-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm space-y-3">
            <BrandLogo size="sm" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Agenda e agendamento para profissionais e estabelecimentos de
              beleza. Elegante, simples e feito para o celular.
            </p>
          </div>
          <nav
            aria-label="Rodapé"
            className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-1 sm:text-right"
          >
            {FOOTER_LINKS.map((item) => (
              <MarketingHashLink
                key={item.href}
                href={item.href}
                className="min-h-11 py-2 text-muted-foreground transition-colors hover:text-foreground sm:min-h-0 sm:py-0"
              >
                {item.label}
              </MarketingHashLink>
            ))}
          </nav>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Agendê. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
