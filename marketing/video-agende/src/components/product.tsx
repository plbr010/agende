import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  House,
  LogOut,
  PackageCheck,
  Settings2,
  Sparkles,
  Star,
  UsersRound,
  WandSparkles,
} from "lucide-react";
import { theme } from "../theme";
import { FloralSprig, Wordmark } from "./stage";

export function StatusChip({
  status,
}: {
  status: "Agendado" | "Confirmado" | "Em atendimento" | "Aguardando confirmação" | "Baixo" | "Sem estoque" | "Normal" | "Já entrou" | "Ainda vai entrar" | "Já saiu";
}) {
  const palette: Record<string, { bg: string; fg: string }> = {
    Agendado: { bg: theme.scheduledBg, fg: theme.scheduledFg },
    "Aguardando confirmação": { bg: theme.scheduledBg, fg: theme.scheduledFg },
    Confirmado: { bg: theme.confirmedBg, fg: theme.confirmedFg },
    "Já entrou": { bg: theme.confirmedBg, fg: theme.confirmedFg },
    Normal: { bg: theme.confirmedBg, fg: theme.confirmedFg },
    "Em atendimento": { bg: theme.progressBg, fg: theme.progressFg },
    "Ainda vai entrar": { bg: theme.metricSand, fg: theme.progressFg },
    Baixo: { bg: theme.metricSand, fg: theme.progressFg },
    "Sem estoque": { bg: "#f8e8e8", fg: "#9f1d2d" },
    "Já saiu": { bg: theme.metricBlush, fg: theme.wine },
  };
  const colors = palette[status] ?? { bg: theme.metricIvory, fg: theme.wineDeep };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        background: colors.bg,
        color: colors.fg,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 650,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

export function Initials({ value, size = 40 }: { value: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        background: "#f3c8c7",
        color: "#631d38",
        fontSize: size * 0.32,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {value}
    </span>
  );
}

export function PhonePage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        height: "100%",
        background:
          "radial-gradient(420px 220px at 0% -10%, rgba(243,196,194,0.9), transparent 60%), radial-gradient(360px 180px at 100% 0%, rgba(232,180,160,0.55), transparent 55%), #fbf4ee",
        color: theme.foreground,
        fontFamily: theme.fontSans,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

export function PhoneHeader({ action }: { action?: string }) {
  return (
    <div
      style={{
        height: 78,
        padding: "30px 16px 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${theme.softRing}`,
        background: "rgba(251,244,238,0.9)",
      }}
    >
      <Wordmark size={22} />
      {action ? (
        <span
          style={{
            height: 36,
            borderRadius: 999,
            background: theme.wine,
            color: "#fffaf8",
            display: "inline-flex",
            alignItems: "center",
            padding: "0 14px",
            fontSize: 13,
            fontWeight: 650,
          }}
        >
          {action}
        </span>
      ) : null}
    </div>
  );
}

const NAV: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Início", icon: House },
  { label: "Agenda", icon: CalendarDays },
  { label: "Clientes", icon: UsersRound },
  { label: "Serviços", icon: WandSparkles },
  { label: "Equipe", icon: Sparkles },
  { label: "Estoque", icon: Boxes },
  { label: "Pacotes", icon: PackageCheck },
  { label: "Financeiro", icon: CircleDollarSign },
  { label: "Relatórios", icon: ChartNoAxesCombined },
  { label: "Avaliações", icon: Star },
  { label: "Configurações", icon: Settings2 },
];

export function AdminChrome({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", height: "100%", background: theme.canvas, fontFamily: theme.fontSans, color: theme.foreground }}>
      <aside
        style={{
          width: 214,
          flexShrink: 0,
          background: theme.wineDeep,
          color: "#fffaf8",
          padding: "18px 12px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ position: "relative", padding: "0 6px 12px" }}>
          <Wordmark size={20} light />
          <FloralSprig style={{ position: "absolute", right: -4, top: -8, width: 36, height: 58, opacity: 0.85 }} />
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "rgba(255,250,248,0.7)" }}>Ateliê Lumière</p>
        </div>
        <div style={{ display: "grid", gap: 2, overflow: "hidden" }}>
          {NAV.map((item) => {
            const Icon = item.icon;
            const current = item.label === active;
            return (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minHeight: 32,
                  borderRadius: 999,
                  padding: "0 10px",
                  background: current ? theme.navPill : "transparent",
                  color: current ? "#fff" : "rgba(255,255,255,0.78)",
                  fontSize: 13.5,
                  fontWeight: 600,
                }}
              >
                <Icon size={15} strokeWidth={1.75} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 6px 8px" }}>
            <Initials value="HD" size={32} />
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 650 }}>Helena Duarte</p>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>Dono · Ateliê Lumière</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.85)", fontSize: 13, padding: "4px 8px" }}>
            <LogOut size={14} /> Sair
          </div>
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: "22px 22px 16px", overflow: "hidden" }}>{children}</main>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: "14px 16px",
        border: `1px solid ${theme.softRing}`,
        marginBottom: 12,
      }}
    >
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.wineDeep }}>
        {eyebrow}
      </p>
      <h2 style={{ margin: "4px 0 0", fontFamily: theme.fontSerif, fontSize: 32, fontWeight: 500, color: theme.wineDeep, letterSpacing: "-0.03em" }}>
        {title}
      </h2>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: theme.muted }}>{description}</p>
    </header>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "blush" | "sand" | "ivory" | "lilac" | "green";
}) {
  const background = {
    blush: theme.metricBlush,
    sand: theme.metricSand,
    ivory: theme.metricIvory,
    lilac: theme.metricLilac,
    green: theme.confirmedBg,
  }[tone];

  return (
    <article
      style={{
        background,
        borderRadius: 18,
        padding: "12px 12px 10px",
        minHeight: 92,
        boxShadow: "0 18px 40px -30px rgba(92,26,46,0.5)",
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: theme.muted, fontWeight: 600 }}>{label}</p>
      <p style={{ margin: "8px 0 0", fontFamily: theme.fontSerif, fontSize: 28, color: theme.wineDeep, letterSpacing: "-0.03em", lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 11, color: theme.muted }}>{hint}</p>
    </article>
  );
}

export function panelStyle(extra?: CSSProperties): CSSProperties {
  return {
    background: "#fff",
    borderRadius: 22,
    border: `1px solid ${theme.softRing}`,
    ...extra,
  };
}
