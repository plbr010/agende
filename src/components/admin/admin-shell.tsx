"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Store,
  Users,
  UsersRound,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
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
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/profissionais", label: "Profissionais", icon: Users },
  { href: "/admin/estabelecimentos", label: "Estabelecimentos", icon: Store },
  { href: "/admin/clientes", label: "Clientes", icon: UsersRound },
  { href: "/admin/assinaturas", label: "Assinaturas", icon: CreditCard },
  { href: "/admin/agendamentos", label: "Agendamentos", icon: CalendarDays },
  { href: "/admin/suporte", label: "Suporte", icon: LifeBuoy },
] as const;

function isCurrent(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Navigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="grid gap-1" aria-label="Navegação master">
      {NAV.map((item) => {
        const current = isCurrent(pathname, item.href);
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

export function AdminShell({
  userName,
  userEmail,
  hasAvatar,
  avatarVersion,
  hasWorkspace,
  children,
}: {
  userName: string;
  userEmail: string;
  hasAvatar: boolean;
  avatarVersion: string | null;
  hasWorkspace: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = NAV.find((item) => isCurrent(pathname, item.href)) ?? NAV[0];

  const menu = (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger
        render={<Button variant="ghost" className="h-11 gap-1 px-2 text-wine-deep" aria-label="Abrir menu master" />}
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
            <BrandLogo size="md" tone="light" href="/admin" />
          </SheetTitle>
          <SheetDescription className="text-white/70">Painel master</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <Navigation pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="agende-app min-h-screen overflow-x-clip lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden h-screen bg-sidebar px-3 py-5 text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:flex-col">
        <div className="px-2 pb-5">
          <BrandLogo size="sm" tone="light" href="/admin" />
          <p className="mt-2 px-0.5 text-xs font-semibold tracking-[0.16em] text-white/55 uppercase">Master admin</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <Navigation pathname={pathname} />
        </div>
        <div className="mt-4 grid gap-2 border-t border-white/15 pt-4">
          {hasWorkspace ? (
            <Button
              variant="ghost"
              className="h-11 justify-start rounded-full px-3 text-white/85 hover:bg-white/10 hover:text-white"
              render={<Link href="/app" />}
            >
              Abrir painel do salão
            </Button>
          ) : null}
          <div className="flex items-center gap-3 px-2">
            <AccountAvatar name={userName} hasAvatar={hasAvatar} version={avatarVersion} alt="" className="bg-[var(--blush)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{userName}</p>
              <p className="truncate text-xs text-white/65">{userEmail}</p>
            </div>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" className="h-11 w-full justify-start rounded-full px-3 text-white/85 hover:bg-white/10 hover:text-white">
              <LogOut className="size-4" /> Sair
            </Button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-[#eadfd8] bg-[var(--app-canvas)]/90 backdrop-blur-xl lg:hidden">
          <div className="flex h-16 items-center justify-between gap-3 px-3">
            {menu}
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate font-serif text-lg leading-none text-wine-deep">{current.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">Painel master</p>
            </div>
            <div className="size-11" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[88rem] px-4 py-5 pb-10 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
