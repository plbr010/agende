"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, ExternalLink, LogOut, Menu, Sparkles } from "lucide-react";
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

function Navigation({ pathname, role, onNavigate }: { pathname: string; role: WorkspaceRole | undefined; onNavigate?: () => void }) {
  return (
    <nav className="grid gap-6" aria-label="Navegação principal">
      {getAppNavigation(role).map((group) => (
        <div key={group.label} className="grid gap-1.5">
          <p className="px-3 text-[0.68rem] font-semibold tracking-[0.18em] text-muted-foreground/80 uppercase">
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
                  current
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                {item.integrationPending && !current ? (
                  <span className="size-1.5 shrink-0 rounded-full bg-accent" title="Integração pendente" />
                ) : null}
                <ChevronRight className={cn("size-3.5 shrink-0 opacity-0 transition-opacity", current && "opacity-70", !current && "group-hover:opacity-60")} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      ))}
      <div className="grid gap-1.5 border-t border-border/70 pt-4">
        <Link
          href={settingsNavigationItem.href}
          onClick={onNavigate}
          aria-current={isNavigationItemCurrent(pathname, settingsNavigationItem.href) ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
            isNavigationItemCurrent(pathname, settingsNavigationItem.href)
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
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
      <aside className="hidden h-screen border-r border-border/70 bg-card/70 p-4 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:flex-col">
        <div className="px-3 py-2">
          <BrandLogo size="md" />
          <p className="mt-1 text-xs text-muted-foreground">Gestão leve para beleza</p>
        </div>
        <div className="my-5 rounded-2xl bg-secondary/60 p-3 ring-1 ring-border/70">
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials(workspaceName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{workspaceName}</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-start text-xs"
            render={<Link href={`/p/${workspaceSlug}`} target="_blank" />}
          >
            Ver página pública <ExternalLink className="ml-auto size-3" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <Navigation pathname={pathname} role={role} />
        </div>
        <div className="mt-4 border-t border-border/70 pt-4">
          <div className="flex items-center gap-3 px-2">
            <Avatar>
              <AvatarFallback>{initials(userName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{userName}</p>
              <Badge variant="outline" className="mt-1">Conta profissional</Badge>
            </div>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sair">
                <LogOut className="size-4" />
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
                render={<Button variant="ghost" size="icon" aria-label="Abrir menu" />}
              >
                <Menu className="size-5" />
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
                      Ver página pública <ExternalLink className="ml-auto size-3.5" />
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
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-semibold">{workspaceName}</p>
              <p className="text-[0.68rem] tracking-wider text-muted-foreground uppercase">Painel Agendê</p>
            </div>
            <Avatar>
              <AvatarFallback className="bg-secondary text-xs">{initials(userName)}</AvatarFallback>
            </Avatar>
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
