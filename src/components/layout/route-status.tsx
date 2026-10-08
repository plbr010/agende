"use client";

import Link from "next/link";
import { AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageLoading({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="grid gap-4" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}…</span>
      <div className="h-28 animate-pulse rounded-[2rem] bg-primary/15" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-3xl bg-secondary/80" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-3xl bg-card ring-1 ring-border/70" />
    </div>
  );
}

export function RouteError({
  retry,
  title = "Não foi possível carregar esta página",
  description = "Sua sessão continua segura. Tente novamente em instantes.",
}: {
  retry: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <div className="agende-bloom grid min-h-[60vh] place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-border/70 bg-card/90 p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <AlertCircle className="size-5" aria-hidden="true" />
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
          <Sparkles className="size-3" /> Agendê
        </p>
        <h1 className="mt-3 font-serif text-3xl">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button className="h-11 rounded-full" onClick={retry}>
            Tentar novamente
          </Button>
          <Button variant="outline" className="h-11 rounded-full" render={<Link href="/" />}>
            Voltar ao início
          </Button>
        </div>
      </div>
    </div>
  );
}
