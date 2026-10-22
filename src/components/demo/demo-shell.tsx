"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CalendarDays, ExternalLink, House, Menu, RotateCcw, UsersRound } from "lucide-react";
import { AccountAvatar } from "@/components/account/account-avatar";
import { FloralSprig } from "@/components/brand/floral";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useDemo } from "@/components/demo/demo-provider";
import { getAppNavigation, settingsNavigationItem } from "@/config/app-navigation";
import { DEMO_BOOK_HREF, DEMO_CLIENT_HREF } from "@/lib/demo/paths";
import { cn } from "@/lib/utils";

function demoHref(href: string): string {
  return href.replace(/^\/app/, "/demo/painel");
}

function current(pathname: string, href: string): boolean {
  if (href === "/demo/painel") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DemoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const demo = useDemo();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = [
    ...getAppNavigation("owner").flatMap((group) => group.items),
    settingsNavigationItem,
  ].map((item) => ({ ...item, href: demoHref(item.href) }));
  const homeCurrent = pathname === "/demo/painel";
  const agendaCurrent = pathname.startsWith("/demo/painel/agenda");
  const clientsCurrent = pathname.startsWith("/demo/painel/clientes");
  const moreCurrent = !homeCurrent && !agendaCurrent && !clientsCurrent;

  const navigation = (
    <nav className="grid gap-1" aria-label="Navegação da demonstração">
      {items.map((item) => {
        const active = current(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-full px-3 text-[0.95rem] font-medium transition-colors",
              active ? "bg-nav-pill text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" : "text-white/78 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="mt-4 grid gap-2 border-t border-white/15 pt-4">
      <Button variant="ghost" className="h-11 justify-start rounded-full px-3 text-white/85 hover:bg-white/10 hover:text-white" render={<Link href={DEMO_CLIENT_HREF} />}>
        Página do salão <ExternalLink className="ml-auto size-3.5" />
      </Button>
      <div className="flex items-center gap-3 px-2">
        <AccountAvatar name="Marina Costa" hasAvatar={false} alt="" className="bg-[var(--blush)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">Marina Costa</p>
          <p className="truncate text-xs text-white/65">Dono · Studio Bella — Demonstração</p>
        </div>
      </div>
      <Button type="button" variant="ghost" className="h-11 justify-start rounded-full px-3 text-white/85 hover:bg-white/10 hover:text-white" onClick={demo.reset}>
        <RotateCcw className="size-4" /> Reiniciar demonstração
      </Button>
    </div>
  );

  return (
    <div className="agende-app min-h-screen overflow-x-clip lg:grid lg:grid-cols-[15.25rem_minmax(0,1fr)]">
      <aside className="hidden h-screen bg-sidebar px-3 py-5 text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:flex-col">
        <div className="relative px-2 pb-5">
          <BrandLogo size="sm" tone="light" href="/demo" />
          <FloralSprig className="pointer-events-none absolute -right-1 top-0 h-14 w-10 opacity-80" />
          <p className="mt-2 truncate px-0.5 text-sm text-white/70">Studio Bella — Demonstração</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{navigation}</div>
        {footer}
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-[#eadfd8] bg-[var(--app-canvas)]/90 backdrop-blur-xl lg:hidden">
          <div className="flex h-16 items-center justify-between gap-3 px-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger render={<Button variant="ghost" className="h-11 gap-1 px-2 text-wine-deep" aria-label="Abrir menu" />}>
                <Menu className="size-5" />
                <span className="text-sm">Menu</span>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(88vw,20rem)] gap-0 border-0 bg-sidebar p-0 text-sidebar-foreground sm:max-w-xs [&_[data-slot=sheet-close]]:text-white [&_[data-slot=sheet-close]]:hover:bg-white/10">
                <SheetHeader className="border-b border-white/15 p-5 text-left">
                  <SheetTitle className="text-white">
                    <BrandLogo size="md" tone="light" href="/demo" />
                  </SheetTitle>
                  <SheetDescription className="text-white/70">Studio Bella — Demonstração · Dono</SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {navigation}
                  {footer}
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate font-serif text-lg leading-none text-wine-deep">Studio Bella</p>
              <p className="mt-1 text-xs text-muted-foreground">Demonstração</p>
            </div>
            <Button variant="ghost" className="h-11 gap-1 px-2 text-wine-deep" aria-label="Agendar como cliente" render={<Link href={DEMO_BOOK_HREF} />}>
              <CalendarDays className="size-5" />
              <span className="text-sm">Cliente</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto grid w-full max-w-[76rem] gap-5 px-4 py-5 pb-28 sm:px-6 sm:py-7 lg:px-8 lg:py-8 lg:pb-10">
          {children}
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#eadfd8] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Atalhos">
          {[
            { href: "/demo/painel", label: "Início", icon: House, active: homeCurrent },
            { href: "/demo/painel/agenda", label: "Agenda", icon: CalendarDays, active: agendaCurrent },
            { href: "/demo/painel/clientes", label: "Clientes", icon: UsersRound, active: clientsCurrent },
          ].map((item) => (
            <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium", item.active ? "text-wine-deep" : "text-muted-foreground")}>
              <item.icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
          <button type="button" className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium", moreCurrent ? "text-wine-deep" : "text-muted-foreground")} aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
            Mais
          </button>
        </nav>
      </div>
    </div>
  );
}
