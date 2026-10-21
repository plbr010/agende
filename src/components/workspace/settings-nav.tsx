"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/app/configuracoes/geral", label: "Dados do salão", billing: false },
  { href: "/app/configuracoes/perfil", label: "Identidade", billing: false },
  { href: "/app/configuracoes/equipe", label: "Equipe", billing: false },
  { href: "/app/configuracoes/assinatura", label: "Assinatura", billing: true },
];

export function SettingsNav({ showBilling = false }: { showBilling?: boolean }) {
  const pathname = usePathname();
  const visible = sections.filter((section) => showBilling || !section.billing);

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Seções das configurações">
      {visible.map((section) => {
        const current = pathname === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm whitespace-nowrap transition-colors",
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
