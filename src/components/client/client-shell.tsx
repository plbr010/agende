"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, LogOut, Sparkles, Star } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/cliente", label: "Início", icon: House },
  { href: "/cliente/agendamentos", label: "Agendamentos", icon: CalendarDays },
  { href: "/cliente/avaliacoes", label: "Avaliações", icon: Star },
];

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function ClientShell({
  userName,
  hasWorkspace,
  children,
}: {
  userName: string;
  hasWorkspace: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="agende-bloom min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <BrandLogo size="sm" />
            <span className="hidden h-5 w-px bg-border sm:block" />
            <span className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex">
              <Sparkles className="size-3 text-primary" /> Meu espaço
            </span>
          </div>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Área da cliente">
            {navigation.map((item) => {
              const current = item.href === "/cliente" ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined} className={cn("flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors", current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
                  <Icon className="size-3.5" /> {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {hasWorkspace ? (
              <Button variant="outline" size="sm" className="hidden rounded-full sm:inline-flex" render={<Link href="/app" />}>
                Área profissional
              </Button>
            ) : null}
            <Avatar>
              <AvatarFallback className="bg-secondary text-xs">{initials(userName)}</AvatarFallback>
            </Avatar>
            <form action={signOutAction}>
              <Button variant="ghost" size="icon" type="submit" aria-label="Sair">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 pb-3 md:hidden" aria-label="Área da cliente">
          {navigation.map((item) => {
            const current = item.href === "/cliente" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined} className={cn("flex min-w-fit flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors", current ? "bg-primary text-primary-foreground" : "bg-card/70 text-muted-foreground ring-1 ring-border")}>
                <Icon className="size-3.5" /> {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-9">{children}</main>
    </div>
  );
}
