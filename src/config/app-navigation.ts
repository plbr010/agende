import {
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  House,
  PackageCheck,
  Settings2,
  Sparkles,
  Star,
  UsersRound,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { canAccessWorkspacePath, type WorkspaceRole } from "@/lib/auth/permissions";

export type AppNavigationItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  integrationPending?: boolean;
};

export type AppNavigationGroup = {
  label: string;
  items: AppNavigationItem[];
};

export const appNavigation: AppNavigationGroup[] = [
  {
    label: "Rotina",
    items: [
      { href: "/app", label: "Visão geral", description: "Seu dia em um só lugar", icon: House },
      { href: "/app/agenda", label: "Agenda", description: "Horários e atendimentos", icon: CalendarDays },
      { href: "/app/clientes", label: "Clientes", description: "Relacionamento e histórico", icon: UsersRound },
      { href: "/app/servicos", label: "Serviços", description: "Catálogo e preços", icon: WandSparkles },
      { href: "/app/equipe", label: "Equipe", description: "Profissionais e jornadas", icon: Sparkles },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/app/estoque", label: "Estoque", description: "Produtos e movimentações", icon: Boxes },
      { href: "/app/pacotes", label: "Pacotes", description: "Combos e créditos", icon: PackageCheck },
      { href: "/app/financeiro", label: "Financeiro", description: "Entradas e saídas", icon: CircleDollarSign },
      { href: "/app/relatorios", label: "Relatórios", description: "Indicadores do negócio", icon: ChartNoAxesCombined },
      { href: "/app/avaliacoes", label: "Avaliações", description: "Reputação e feedbacks", icon: Star },
    ],
  },
];

export const settingsNavigationItem: AppNavigationItem = {
  href: "/app/configuracoes",
  label: "Configurações",
  description: "Perfil e preferências",
  icon: Settings2,
};

export function getAppNavigation(role: WorkspaceRole | null | undefined): AppNavigationGroup[] {
  return appNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessWorkspacePath(item.href, role)),
    }))
    .filter((group) => group.items.length > 0);
}

export function isNavigationItemCurrent(pathname: string, href: string): boolean {
  if (href === "/app") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
