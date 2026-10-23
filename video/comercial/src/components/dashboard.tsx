import React from "react";
import { C } from "../theme";
import { fontSans, fontSerif } from "../fonts";
import { Avatar, Chip, Metric, PageHead } from "./ui";
import { FloralSprig } from "./floral";
import {
  AGENDA,
  CLIENTS,
  FINANCE,
  HOME_METRICS,
  NEW_APPOINTMENT,
  SALON,
  SERVICES,
  TEAM,
} from "../demo-data";

function AppointmentCard({
  item,
  highlight = false,
}: {
  item: {
    start: string;
    end: string;
    client: string;
    initials: string;
    service: string;
    pro: string;
    status: "scheduled" | "confirmed";
    minutes: number;
    price: string;
  };
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: "8px 10px",
        textAlign: "left",
        background: highlight ? C.metricBlush : "rgba(243,196,194,0.28)",
        border: `1px solid ${highlight ? C.roseInk : "rgba(107,45,66,0.12)"}`,
      }}
    >
      <p style={{ margin: 0, fontFamily: fontSerif, fontSize: 18, color: C.wineDeep, lineHeight: 1 }}>
        {item.start}–{item.end}
      </p>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <Avatar initials={item.initials} size={28} />
        <span style={{ fontFamily: fontSans, fontWeight: 600, fontSize: 14, color: C.ink }}>{item.client}</span>
      </div>
      <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: 12, color: C.muted }}>
        {item.service} · {item.pro}
      </p>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <Chip tone={item.status === "confirmed" ? "confirmed" : "scheduled"}>
          {item.status === "confirmed" ? "Confirmado" : "Agendado"}
        </Chip>
        <span style={{ fontFamily: fontSans, fontSize: 11, color: C.muted }}>
          {item.minutes} min · {item.price}
        </span>
      </div>
    </div>
  );
}

export function HomeScreen() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: fontSerif, fontSize: 30, color: C.wineDeep, lineHeight: 1 }}>
            Olá, {SALON.ownerFirst}!
          </h1>
          <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: 13, color: C.muted }}>
            {SALON.name} · seu negócio está indo bem hoje
          </p>
        </div>
        <FloralSprig style={{ width: 36, height: 58 }} />
      </div>
      <div
        style={{
          alignSelf: "start",
          height: 36,
          borderRadius: 999,
          padding: "0 12px",
          display: "inline-flex",
          alignItems: "center",
          background: "rgba(255,255,255,0.8)",
          border: `1px solid ${C.ring}`,
          fontFamily: fontSans,
          fontSize: 12,
          color: C.muted,
        }}
      >
        {SALON.todayLabel}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {HOME_METRICS.map((metric) => (
          <Metric key={metric.label} {...metric} />
        ))}
      </div>
    </div>
  );
}

export function AgendaScreen({ showNew }: { showNew: boolean }) {
  const items = showNew ? [...AGENDA, NEW_APPOINTMENT] : AGENDA;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Metric label="Na agenda" value={String(items.length)} hint="no dia selecionado" tone="blush" />
        <Metric label="Confirmados" value="2" hint="clientes confirmados" tone="success" />
      </div>
      <div
        style={{
          borderRadius: 24,
          background: C.paper,
          padding: 12,
          border: `1px solid rgba(107,45,66,0.1)`,
        }}
      >
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 12, color: C.muted }}>Quinta-feira</p>
        <h3 style={{ margin: "2px 0 10px", fontFamily: fontSerif, fontSize: 28, color: C.wine }}>22/10</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item) => (
            <AppointmentCard key={item.id} item={item} highlight={item.id === "new"} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ClientsScreen() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <PageHead eyebrow="Relacionamento" title="Clientes" description="Uma base organizada para acolher cada pessoa com contexto." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <Metric label="Clientes ativos" value="86" hint="na sua base" tone="blush" />
        <Metric label="Com contato" value="84" hint="telefone ou e-mail" tone="success" />
        <Metric label="Com observações" value="31" hint="preferências" tone="ivory" />
      </div>
      <div
        style={{
          height: 40,
          borderRadius: 14,
          background: C.paper,
          border: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          fontFamily: fontSans,
          fontSize: 13,
          color: C.muted,
        }}
      >
        Nome, telefone ou e-mail
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {CLIENTS.map((client) => (
          <div
            key={client.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 18,
              background: C.paper,
              padding: 12,
              border: `1px solid ${C.ring}`,
            }}
          >
            <Avatar initials={client.name.split(" ").map((p) => p[0]).join("")} size={40} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: fontSans, fontWeight: 600, fontSize: 14, color: C.ink }}>{client.name}</p>
              <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 12, color: C.muted }}>
                {client.contact}
                {client.note ? ` · ${client.note}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ServicesScreen() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <PageHead eyebrow="O que você oferece" title="Serviços" description="O que você oferece, quanto tempo dura e o preço." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Metric label="Serviços" value="3" hint="serviços cadastrados" tone="blush" />
        <Metric label="Ativos" value="3" hint="disponíveis para agenda" tone="success" />
        <Metric label="Preço médio" value="R$ 133,00" hint="entre serviços ativos" tone="sand" />
        <Metric label="Duração média" value="78 min" hint="tempo por atendimento" tone="ivory" />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {SERVICES.map((service) => (
          <div
            key={service.id}
            style={{
              borderRadius: 18,
              background: C.paper,
              padding: 14,
              border: `1px solid ${C.ring}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <h3 style={{ margin: 0, fontFamily: fontSerif, fontSize: 20, color: C.wineDeep, fontWeight: 500 }}>
                {service.name}
              </h3>
              <span style={{ fontFamily: fontSans, fontWeight: 600, fontSize: 13, color: C.wineDeep }}>{service.price}</span>
            </div>
            <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: 12, color: C.muted }}>
              {service.minutes} min · Ativo
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamScreen() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <PageHead eyebrow="Pessoas" title="Equipe" description="Quem atende, o que cada pessoa faz e os horários de trabalho." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <Metric label="Pessoas ativas" value="2" hint="pessoas na equipe" tone="blush" />
        <Metric label="Na agenda" value="2" hint="quem recebe reservas" tone="success" />
        <Metric label="Serviços por profissional" value="4" hint="o que cada pessoa faz" tone="ivory" />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {TEAM.map((member) => (
          <div
            key={member.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 18,
              background: C.paper,
              padding: 12,
              border: `1px solid ${C.ring}`,
            }}
          >
            <Avatar initials={member.name.split(" ").map((p) => p[0]).join("")} size={44} />
            <div>
              <p style={{ margin: 0, fontFamily: fontSans, fontWeight: 600, fontSize: 15, color: C.ink }}>{member.name}</p>
              <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 12, color: C.muted }}>
                {member.role} · {member.services} serviços · Na agenda
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FinanceScreen() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <PageHead
        eyebrow="Dinheiro do salão"
        title="Financeiro"
        description="Anote o que entrou, o que saiu e o que ainda falta pagar."
      />
      <div
        style={{
          alignSelf: "start",
          height: 34,
          borderRadius: 999,
          padding: "0 14px",
          display: "inline-flex",
          alignItems: "center",
          background: C.wine,
          color: C.white,
          fontFamily: fontSans,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {FINANCE.period}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Metric label="Dinheiro que entrou" value={FINANCE.in} hint="já recebido neste período" tone="success" />
        <Metric label="Dinheiro que saiu" value={FINANCE.out} hint="já pago neste período" tone="blush" />
        <Metric label="Ainda em aberto" value={FINANCE.pending} hint="falta entrar ou sair" tone="sand" />
        <Metric label="Quanto sobrou" value={FINANCE.leftover} hint="entradas menos saídas" tone="ivory" />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {FINANCE.entries.slice(0, 3).map((entry) => (
          <div
            key={`${entry.title}-${entry.status}`}
            style={{
              borderRadius: 20,
              background: C.paper,
              padding: 12,
              border: `1px solid ${C.border}`,
              borderLeft: `4px solid ${entry.kind === "Entrada" ? C.success : C.wine}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <p style={{ margin: 0, fontFamily: fontSans, fontWeight: 600, fontSize: 14, color: C.ink }}>{entry.title}</p>
                <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 12, color: C.muted }}>
                  {entry.kind} · {entry.meta}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontFamily: fontSans, fontWeight: 700, fontSize: 14, color: C.wineDeep }}>
                  {entry.amount}
                </p>
                <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 11, color: C.muted }}>{entry.status}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
