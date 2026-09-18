"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/app/configuracoes/geral", label: "Geral" },
  { href: "/app/configuracoes/perfil", label: "Perfil público" },
  { href: "/app/configuracoes/equipe", label: "Equipe" },
  { href: "/app/configuracoes/assinatura", label: "Assinatura" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto pb-1">
      {sections.map((section) => {
        const current = pathname === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              "rounded-full px-3 py-2 text-sm whitespace-nowrap transition-colors",
              current
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
