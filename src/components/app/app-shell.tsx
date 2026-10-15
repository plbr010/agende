"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarDays, CalendarPlus, ExternalLink, House, LogOut, Menu, UsersRound } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { FloralSprig } from "@/components/brand/floral";
import { AccountAvatar } from "@/components/account/account-avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getAppNavigation, isNavigationItemCurrent, settingsNavigationItem } from "@/config/app-navigation";
import type { WorkspaceRole } from "@/lib/auth/permissions";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

function Navigation({
  pathname,
  role,
  onNavigate,
}: {
  pathname: string;
  role: WorkspaceRole | undefined;
  onNavigate?: () => void;
}) {
  const items = [
    ...getAppNavigation(role).flatMap((group) => group.items),
    settingsNavigationItem,
  ];

  return (
    <nav className="grid gap-1" aria-label="Navegação principal">
      {items.map((item) => {
        const current = isNavigationItemCurrent(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-full px-3 text-[0.95rem] font-medium transition-colors",
              current
                ? "bg-nav-pill text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                : "text-white/78 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({
  workspaceName,
  workspaceSlug,
  userName,
  roleLabel,
  hasAvatar,
  avatarVersion,
}: {
  workspaceName: string;
  workspaceSlug: string;
  userName: string;
  roleLabel: string;
  hasAvatar: boolean;
  avatarVersion: string | null;
}) {
  return (
    <div className="mt-4 grid gap-2 border-t border-white/15 pt-4">
      {workspaceSlug ? (
        <Button
          variant="ghost"
          className="h-11 justify-start rounded-full px-3 text-white/85 hover:bg-white/10 hover:text-white"
          render={<Link href={`/p/${workspaceSlug}`} target="_blank" />}
        >
          Página do salão <ExternalLink className="ml-auto size-3.5" />
        </Button>
      ) : null}
      <div className="flex items-center gap-3 px-2">
        <AccountAvatar name={userName} hasAvatar={hasAvatar} version={avatarVersion} alt="" className="bg-[var(--blush)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{userName}</p>
          <p className="truncate text-xs text-white/65">{roleLabel} · {workspaceName}</p>
        </div>
      </div>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" className="h-11 w-full justify-start rounded-full px-3 text-white/85 hover:bg-white/10 hover:text-white">
          <LogOut className="size-4" /> Sair
        </Button>
      </form>
    </div>
  );
}

export function AppShell({
  workspaceName,
  workspaceSlug,
  userName,
  roleLabel,
  role,
  hasAvatar = false,
  avatarVersion = null,
  children,
}: {
  workspaceName: string;
  workspaceSlug: string;
  userName: string;
  roleLabel: string;
  role: WorkspaceRole | undefined;
  hasAvatar?: boolean;
  avatarVersion?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const homeCurrent = pathname === "/app";
  const agendaCurrent = pathname.startsWith("/app/agenda");
  const clientsCurrent = pathname.startsWith("/app/clientes");
  const moreCurrent = !homeCurrent && !agendaCurrent && !clientsCurrent;

  const menu = (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger
        render={<Button variant="ghost" className="h-11 gap-1 px-2 text-wine-deep" aria-label="Abrir menu" />}
      >
        <Menu className="size-5" />
        <span className="text-sm">Menu</span>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[min(88vw,20rem)] gap-0 border-0 bg-sidebar p-0 text-sidebar-foreground sm:max-w-xs [&_[data-slot=sheet-close]]:text-white [&_[data-slot=sheet-close]]:hover:bg-white/10"
      >
        <SheetHeader className="border-b border-white/15 p-5 text-left">
          <SheetTitle className="text-white">
            <BrandLogo size="md" tone="light" href="/app" />
          </SheetTitle>
          <SheetDescription className="text-white/70">
            {workspaceName} · {roleLabel}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <Navigation pathname={pathname} role={role} onNavigate={() => setMobileOpen(false)} />
          <SidebarFooter
            workspaceName={workspaceName}
            workspaceSlug={workspaceSlug}
            userName={userName}
            roleLabel={roleLabel}
            hasAvatar={hasAvatar}
            avatarVersion={avatarVersion}
          />
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="agende-app min-h-screen overflow-x-clip lg:grid lg:grid-cols-[15.25rem_minmax(0,1fr)]">
      <aside className="hidden h-screen bg-sidebar px-3 py-5 text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:flex-col">
        <div className="relative px-2 pb-5">
          <BrandLogo size="sm" tone="light" href="/app" />
          <FloralSprig className="pointer-events-none absolute -right-1 top-0 h-14 w-10 opacity-80" />
          <p className="mt-2 truncate px-0.5 text-sm text-white/70">{workspaceName}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <Navigation pathname={pathname} role={role} />
        </div>
        <SidebarFooter
          workspaceName={workspaceName}
          workspaceSlug={workspaceSlug}
          userName={userName}
          roleLabel={roleLabel}
          hasAvatar={hasAvatar}
          avatarVersion={avatarVersion}
        />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-[#eadfd8] bg-[var(--app-canvas)]/90 backdrop-blur-xl lg:hidden">
          <div className="flex h-16 items-center justify-between gap-3 px-3">
            {menu}
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate font-serif text-lg leading-none text-wine-deep">{workspaceName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <Button
              variant="ghost"
              className="h-11 gap-1 px-2 text-wine-deep"
              aria-label="Novo horário"
              render={<Link href="/app/agenda?novo=1" />}
            >
              <CalendarPlus className="size-5" />
              <span className="text-sm">Novo</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[76rem] px-4 py-5 pb-28 sm:px-6 sm:py-7 lg:px-8 lg:py-8 lg:pb-10">
          {children}
        </main>
        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#eadfd8] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
          aria-label="Atalhos"
        >
          {[
            { href: "/app", label: "Início", icon: House, current: homeCurrent },
            { href: "/app/agenda", label: "Agenda", icon: CalendarDays, current: agendaCurrent },
            { href: "/app/clientes", label: "Clientes", icon: UsersRound, current: clientsCurrent },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                item.current ? "text-wine-deep" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
              moreCurrent ? "text-wine-deep" : "text-muted-foreground",
            )}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
            Mais
          </button>
        </nav>
      </div>
    </div>
  );
}
