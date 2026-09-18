import { BrandLogo } from "@/components/brand/logo";

export function MarketingLegalLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main id="conteudo" className="mx-auto w-full min-w-0 max-w-3xl flex-1 px-4 py-10 sm:py-16">
      <BrandLogo className="mb-8" />
      <article className="rounded-[1.8rem] bg-card/90 px-5 py-8 shadow-[0_20px_50px_-32px_oklch(0.4_0.04_25/0.35)] ring-1 ring-border sm:px-10 sm:py-12">
        <p className="text-[0.7rem] font-medium tracking-[0.2em] text-primary uppercase">
          Agendê
        </p>
        <h1 className="mt-2 font-serif text-4xl leading-tight tracking-tight">{title}</h1>
        <div className="mt-8 space-y-4 text-base leading-relaxed text-muted-foreground">
          {children}
        </div>
      </article>
    </main>
  );
}
