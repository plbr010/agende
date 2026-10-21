"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Compass, Heart, House, Sparkles, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { AccountAvatar } from "@/components/account/account-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const CLIENT_NAVIGATION = [
  { href: "/cliente", label: "Início", icon: House },
  { href: "/cliente/descobrir", label: "Explorar", icon: Compass },
  { href: "/cliente/agendamentos", label: "Agendamentos", icon: CalendarDays },
  { href: "/cliente/favoritos", label: "Favoritos", icon: Heart },
  { href: "/cliente/perfil", label: "Perfil", icon: UserRound },
] as const;

function previewAsClientPath(pathname: string): string {
  if (pathname === "/identidade/cliente" || pathname.startsWith("/identidade/cliente/")) {
    return pathname.replace("/identidade/cliente", "/cliente") || "/cliente";
  }
  return pathname;
}

function isCurrentPath(pathname: string, href: string): boolean {
  const current = previewAsClientPath(pathname);
  return href === "/cliente" ? current === href : current.startsWith(href);
}

export function ClientShell({
  userName,
  hasWorkspace,
  hasAvatar = false,
  avatarVersion = null,
  children,
}: {
  userName: string;
  hasWorkspace: boolean;
  hasAvatar?: boolean;
  avatarVersion?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="agende-bloom min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[#f0e4de]/80 bg-[color-mix(in_srgb,var(--cream)_88%,white)]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <BrandLogo size="sm" href="/cliente" />
            <span className="hidden h-5 w-px bg-border sm:block" />
            <span className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex">
              <Sparkles className="size-3 text-[var(--rose-ink)]" aria-hidden="true" /> Seu espaço
            </span>
          </div>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Área da cliente">
            {CLIENT_NAVIGATION.map((item) => {
              const current = isCurrentPath(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
                    current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" /> {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {hasWorkspace ? (
              <>
                <Button variant="outline" className="hidden h-11 rounded-full sm:inline-flex" render={<Link href="/app" />}>
                  Área profissional
                </Button>
                <Button
                  variant="outline"
                  className="size-11 rounded-full sm:hidden"
                  aria-label="Área profissional"
                  render={<Link href="/app" />}
                >
                  <Sparkles className="size-4" />
                </Button>
              </>
            ) : null}
            <Link href="/cliente/perfil" aria-label="Abrir perfil" className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50">
              <AccountAvatar name={userName} hasAvatar={hasAvatar} version={avatarVersion} alt="" />
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 pb-32 sm:px-6 sm:py-9 lg:pb-9">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#f0e4de] bg-[color-mix(in_srgb,var(--cream)_92%,white)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        aria-label="Área da cliente"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-[repeat(5,minmax(0,1fr))] gap-0.5 px-1 py-2">
          {CLIENT_NAVIGATION.map((item) => {
            const current = isCurrentPath(pathname, item.href);
            const Icon = item.icon;
            const compact = item.href === "/cliente/agendamentos" ? "Agenda" : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 text-center text-[0.65rem] leading-tight font-medium transition-colors",
                  current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className={compact ? "max-[389px]:sr-only" : undefined}>{item.label}</span>
                {compact ? (
                  <span className="min-[390px]:hidden" aria-hidden="true">{compact}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
