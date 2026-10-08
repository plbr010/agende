import Link from "next/link";
import { Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="agende-bloom grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-border/70 bg-card/90 p-8 text-center shadow-sm">
        <BrandLogo className="mx-auto mb-6" />
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
          <Sparkles className="size-3" /> Página não encontrada
        </p>
        <h1 className="mt-3 font-serif text-3xl">Esse endereço não existe no Agendê</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Confira o link ou volte para a página inicial. Nada da sua conta foi alterado.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button className="h-11 rounded-full" render={<Link href="/" />}>
            Ir para o início
          </Button>
          <Button variant="outline" className="h-11 rounded-full" render={<Link href="/login" />}>
            Entrar
          </Button>
        </div>
      </div>
    </div>
  );
}
