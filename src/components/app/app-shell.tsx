"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, ChevronRight, ExternalLink, LogOut, Menu, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Navigation({
  pathname,
  role,
  onNavigate,
  tone = "paper",
}: {
  pathname: string;
  role: WorkspaceRole | undefined;
  onNavigate?: () => void;
  tone?: "paper" | "wine";
}) {
  const currentClass = tone === "wine"
    ? "bg-secondary text-secondary-foreground shadow-sm"
    : "bg-primary text-primary-foreground shadow-sm shadow-primary/20";
  const idleClass = tone === "wine"
    ? "text-white/85 hover:bg-white/10 hover:text-white"
    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground";
  return (
    <nav className="grid gap-6" aria-label="Navegação principal">
      {getAppNavigation(role).map((group) => (
        <div key={group.label} className="grid gap-1.5">
          <p className={cn("px-3 text-[0.68rem] font-semibold tracking-[0.18em] uppercase", tone === "wine" ? "text-white/55" : "text-muted-foreground/80")}>
            {group.label}
          </p>
          {group.items.map((item) => {
            const current = isNavigationItemCurrent(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "group flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all",
                  current ? currentClass : idleClass,
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                {item.integrationPending && !current ? (
                  <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-medium", tone === "wine" ? "bg-white/15 text-white" : "bg-accent text-foreground")}>Em breve</span>
                ) : null}
                <ChevronRight className={cn("size-3.5 shrink-0 opacity-0 transition-opacity", current && "opacity-70", !current && "group-hover:opacity-60")} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      ))}
      <div className={cn("grid gap-1.5 border-t pt-4", tone === "wine" ? "border-white/15" : "border-border/70")}>
        <Link
          href={settingsNavigationItem.href}
          onClick={onNavigate}
          aria-current={isNavigationItemCurrent(pathname, settingsNavigationItem.href) ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
            isNavigationItemCurrent(pathname, settingsNavigationItem.href) ? currentClass : idleClass,
          )}
        >
          <settingsNavigationItem.icon className="size-4" aria-hidden="true" />
          {settingsNavigationItem.label}
        </Link>
      </div>
    </nav>
  );
}

export function AppShell({
  workspaceName,
  workspaceSlug,
  userName,
  roleLabel,
  role,
  children,
}: {
  workspaceName: string;
  workspaceSlug: string;
  userName: string;
  roleLabel: string;
  role: WorkspaceRole | undefined;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="agende-bloom min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="hidden h-screen bg-sidebar p-4 text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:flex-col">
        <div className="px-3 py-2">
          <BrandLogo size="md" tone="light" />
          <p className="mt-1 text-xs text-white/70">Agenda do seu salão</p>
        </div>
        <div className="my-5 rounded-2xl bg-white/10 p-3">
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                {initials(workspaceName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{workspaceName}</p>
              <p className="truncate text-xs text-white/70">{roleLabel}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="mt-3 h-11 w-full justify-start text-sidebar-foreground hover:bg-white/10 hover:text-white"
            render={<Link href={`/p/${workspaceSlug}`} target="_blank" />}
          >
            Ver página do salão <ExternalLink className="ml-auto size-3" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <Navigation pathname={pathname} role={role} tone="wine" />
        </div>
        <div className="mt-4 border-t border-white/15 pt-4">
          <div className="flex items-center gap-3 px-2">
            <Avatar>
              <AvatarFallback className="bg-secondary text-secondary-foreground">{initials(userName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{userName}</p>
              <Badge variant="outline" className="mt-1 border-white/30 text-white">Conta profissional</Badge>
            </div>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" className="h-11 px-3 text-sidebar-foreground hover:bg-white/10 hover:text-white" aria-label="Sair">
                <LogOut className="size-4" /> Sair
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl lg:hidden">
          <div className="flex h-16 items-center justify-between gap-3 px-4">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={<Button variant="ghost" className="h-11 gap-1 px-2" aria-label="Abrir menu" />}
              >
                <Menu className="size-5" />
                <span className="text-sm">Menu</span>
              </SheetTrigger>
              <SheetContent side="left" className="w-[88%] gap-0 p-0 sm:max-w-xs">
                <SheetHeader className="border-b border-border/70 p-5 text-left">
                  <SheetTitle><BrandLogo size="md" /></SheetTitle>
                  <SheetDescription className="sr-only">Navegação do Agendê</SheetDescription>
                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
                    <Avatar size="lg">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {initials(workspaceName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{workspaceName}</p>
                      <p className="text-xs">{roleLabel}</p>
                    </div>
                  </div>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <Navigation pathname={pathname} role={role} onNavigate={() => setMobileOpen(false)} />
                </div>
                <div className="grid gap-2 border-t border-border/70 p-4">
                  {workspaceSlug ? (
                    <Button
                      variant="outline"
                      className="h-11 justify-start rounded-2xl"
                      render={<Link href={`/p/${workspaceSlug}`} target="_blank" />}
                      onClick={() => setMobileOpen(false)}
                    >
                      Ver página do salão <ExternalLink className="ml-auto size-3.5" />
                    </Button>
                  ) : null}
                  <form action={signOutAction}>
                    <Button type="submit" variant="ghost" className="h-11 w-full justify-start rounded-2xl">
                      <LogOut className="size-4" /> Sair da conta
                    </Button>
                  </form>
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-semibold">{workspaceName}</p>
              <p className="text-[0.68rem] tracking-wider text-muted-foreground uppercase">Área do salão</p>
            </div>
            <Button
              variant="ghost"
              className="h-11 gap-1 px-2"
              aria-label="Novo horário"
              render={<Link href="/app/agenda?novo=1" />}
            >
              <CalendarPlus className="size-5" />
              <span className="text-sm">Novo</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-5 sm:px-6 sm:py-8 xl:px-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground lg:hidden">
            <Sparkles className="size-3 text-primary" />
            <span>{roleLabel}</span>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
