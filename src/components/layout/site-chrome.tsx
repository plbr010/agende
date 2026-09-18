import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <BrandLogo size="sm" />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" className="h-10 px-3" render={<Link href="/login" />}>
            Entrar
          </Button>
          <Button className="h-10 px-4" render={<Link href="/cadastro" />}>
            Começar agora
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <BrandLogo size="sm" />
        <div className="flex gap-4">
          <Link href="/termos" className="hover:text-foreground">
            Termos de Uso
          </Link>
          <Link href="/privacidade" className="hover:text-foreground">
            Política de Privacidade
          </Link>
        </div>
      </div>
    </footer>
  );
}
