"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/app/configuracoes/geral", label: "Dados do salão", billing: false, owner: false, managers: false },
  { href: "/app/configuracoes/perfil", label: "Identidade", billing: false, owner: false, managers: false },
  { href: "/app/configuracoes/equipe", label: "Equipe", billing: false, owner: false, managers: false },
  { href: "/app/configuracoes/comissoes", label: "Comissões", billing: false, owner: false, managers: true },
  { href: "/app/configuracoes/permissoes", label: "Permissões", billing: false, owner: true, managers: false },
  { href: "/app/configuracoes/assinatura", label: "Assinatura", billing: true, owner: false, managers: false },
];

export function SettingsNav({
  showBilling = false,
  showPermissions = false,
  showCommissions = showBilling,
}: {
  showBilling?: boolean;
  showPermissions?: boolean;
  showCommissions?: boolean;
}) {
  const pathname = usePathname();
  const visible = sections.filter((section) => {
    if (section.billing && !showBilling) return false;
    if (section.owner && !showPermissions) return false;
    if (section.managers && !showCommissions) return false;
    return true;
  });

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
