"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const links = [
  { href: "/app", label: "Início" },
  { href: "/app/agenda", label: "Agenda" },
  { href: "/app/equipe", label: "Equipe" },
  { href: "/app/servicos", label: "Serviços" },
  { href: "/app/clientes", label: "Clientes" },
];

export function AppShell({
  workspaceName,
  children,
}: {
  workspaceName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="agende-bloom min-h-full">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo size="sm" className="shrink-0" />
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              {workspaceName}
            </span>
          </div>
          <form action={signOutAction}>
            <Button variant="ghost" type="submit">
              Sair
            </Button>
          </form>
        </div>
        <nav className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-4 pb-3">
          {links.map((link) => {
            const current =
              link.href === "/app"
                ? pathname === "/app"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                  current
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">{children}</main>
    </div>
  );
}
