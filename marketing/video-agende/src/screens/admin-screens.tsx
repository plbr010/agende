import { Star } from "lucide-react";
import { dashboardVisits, dayAppointments, financeEntries, salon, stock, team, weekColumns } from "../fixtures";
import { theme } from "../theme";
import { AdminChrome, Initials, Metric, PageHeading, StatusChip, panelStyle } from "../components/product";

function VisitRow({
  time,
  client,
  service,
  professional,
  status,
  highlight,
}: {
  time: string;
  client: string;
  service: string;
  professional: string;
  status: "Agendado" | "Confirmado";
  highlight?: boolean;
}) {
  const initials = client.split(" ").map((part) => part[0]).slice(0, 2).join("");
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "64px 1fr auto",
        gap: 10,
        alignItems: "center",
        padding: "8px 8px",
        borderRadius: 16,
        background: highlight ? "rgba(253,236,234,0.85)" : "transparent",
        boxShadow: highlight ? `inset 0 0 0 1px ${theme.blush}` : undefined,
      }}
    >
      <p style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 22, color: theme.wineDeep }}>{time}</p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
        <Initials value={initials} size={36} />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 650, fontSize: 14 }}>{client}</p>
          <p style={{ margin: 0, fontSize: 12, color: theme.muted }}>{service} · {professional}</p>
        </div>
      </div>
      <StatusChip status={status} />
    </div>
  );
}

export function DashboardScreen({ confirmed }: { confirmed: boolean }) {
  return (
    <AdminChrome active="Início">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 36, fontWeight: 500, color: theme.wineDeep, letterSpacing: "-0.03em" }}>
            Olá, Helena!
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: theme.muted }}>{salon.name} · seu negócio está indo bem hoje</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ borderRadius: 999, background: "rgba(255,255,255,0.85)", border: `1px solid ${theme.softRing}`, padding: "8px 12px", fontSize: 12, color: theme.muted }}>
            {salon.todayLabel}
          </span>
          <span style={{ borderRadius: 999, background: theme.wine, color: "#fffaf8", padding: "8px 14px", fontSize: 13, fontWeight: 700 }}>
            Novo horário
          </span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
        <Metric label="Agendamentos hoje" value="4" hint="↑ 12% vs. ontem" tone="blush" />
        <Metric label="Receita do dia" value="R$ 750,00" hint="Soma dos horários, sem faltas" tone="sand" />
        <Metric label="Clientes ativos" value="86" hint="Cadastrados no salão" tone="ivory" />
        <article style={{ background: theme.metricLilac, borderRadius: 18, padding: 12 }}>
          <p style={{ margin: 0, fontSize: 12, color: theme.muted, fontWeight: 600 }}>Avaliação média</p>
          <p style={{ margin: "8px 0 0", fontFamily: theme.fontSerif, fontSize: 28, color: theme.wineDeep, lineHeight: 1 }}>{salon.rating}</p>
          <p style={{ margin: "6px 0 0", display: "flex", gap: 2 }}>
            {Array.from({ length: 5 }, (_, index) => (
              <Star key={index} size={12} color="#c47b62" fill="#c47b62" />
            ))}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: theme.muted }}>{salon.reviews} recebidas</p>
        </article>
      </div>
      <section style={panelStyle({ padding: "14px 12px" })}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 8px 6px" }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 26, fontWeight: 500, color: theme.wineDeep }}>Agenda de hoje</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: theme.muted }}>{salon.todayLabel}</p>
          </div>
          <span style={{ fontSize: 13, fontWeight: 650, color: theme.wineDeep }}>Ver agenda</span>
        </div>
        {dashboardVisits.map((visit) => (
          <VisitRow
            key={visit.time}
            time={visit.time}
            client={visit.client}
            service={visit.service}
            professional={visit.professional}
            status={visit.fresh && confirmed ? "Confirmado" : visit.status}
            highlight={Boolean(visit.fresh)}
          />
        ))}
        {confirmed ? null : (
          <div style={{ margin: "8px 8px 0", display: "flex", justifyContent: "flex-end" }}>
            <span style={{ borderRadius: 999, background: theme.wine, color: "#fffaf8", padding: "8px 14px", fontSize: 13, fontWeight: 700 }}>
              Confirmar cliente
            </span>
          </div>
        )}
      </section>
    </AdminChrome>
  );
}

export function AgendaScreen({ week }: { week: boolean }) {
  return (
    <AdminChrome active="Agenda">
      <PageHeading eyebrow="Sua agenda" title="Atendimentos" description="Veja o dia, marque clientes e atualize cada horário." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
        <Metric label="Na agenda" value={week ? "8" : "4"} hint={week ? "na semana selecionada" : "no dia selecionado"} tone="blush" />
        <Metric label="Confirmados" value={week ? "5" : "2"} hint="clientes confirmados" tone="green" />
        <Metric label="Em atendimento" value="0" hint="acontecendo agora" tone="sand" />
        <Metric label={week ? "Total da semana" : "Total do dia"} value={week ? "R$ 1.250,00" : "R$ 750,00"} hint="só horários que ainda valem" tone="ivory" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["Anterior", "Hoje", "Próximo"].map((label) => (
            <span key={label} style={{ borderRadius: 12, border: `1px solid ${theme.border}`, background: "#fff", padding: "6px 10px", fontSize: 12, fontWeight: 650 }}>{label}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ borderRadius: 12, background: week ? "#fff" : theme.wine, color: week ? theme.foreground : "#fffaf8", border: `1px solid ${week ? theme.border : theme.wine}`, padding: "6px 12px", fontSize: 12, fontWeight: 700 }}>Dia</span>
          <span style={{ borderRadius: 12, background: week ? theme.wine : "#fff", color: week ? "#fffaf8" : theme.foreground, border: `1px solid ${week ? theme.wine : theme.border}`, padding: "6px 12px", fontSize: 12, fontWeight: 700 }}>Semana</span>
        </div>
      </div>
      {week ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {weekColumns.map((column) => (
            <section key={column.day} style={panelStyle({ padding: 8, minHeight: 210 })}>
              <p style={{ margin: 0, fontSize: 11, color: theme.muted }}>{column.label}</p>
              <h3 style={{ margin: "2px 0 8px", fontFamily: theme.fontSerif, fontSize: 18, color: theme.wine }}>{column.day}</h3>
              {column.items.length === 0 ? (
                <p style={{ margin: 0, fontSize: 11, color: theme.muted, background: "rgba(243,196,194,0.35)", borderRadius: 12, padding: 8 }}>Nada marcado neste dia.</p>
              ) : (
                column.items.map((item) => (
                  <p key={item} style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 650, background: column.day === "20/10" && item.includes("Marina") ? theme.metricBlush : "rgba(243,196,194,0.28)", borderRadius: 10, padding: "6px 6px" }}>
                    {item}
                  </p>
                ))
              )}
            </section>
          ))}
        </div>
      ) : (
        <section style={panelStyle({ padding: 12 })}>
          <p style={{ margin: 0, fontSize: 12, color: theme.muted }}>Agenda</p>
          <h3 style={{ margin: "2px 0 8px", fontFamily: theme.fontSerif, fontSize: 28, fontWeight: 500, color: theme.wine }}>20/10</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {dayAppointments.map((item) => (
              <article key={item.start} style={{ background: item.fresh ? theme.metricBlush : "rgba(243,196,194,0.28)", borderRadius: 14, padding: "8px 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <p style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 16, color: theme.wineDeep }}>{item.start}–{item.end}</p>
                  <StatusChip status={item.status} />
                </div>
                <p style={{ margin: "4px 0 0", fontWeight: 700, fontSize: 13 }}>{item.client}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: theme.muted }}>{item.service} · {item.professional}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: theme.muted }}>{item.meta}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </AdminChrome>
  );
}

export function TeamScreen() {
  return (
    <AdminChrome active="Equipe">
      <PageHeading eyebrow="Pessoas" title="Equipe" description="Quem atende, o que cada pessoa faz e os horários de trabalho." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
        <Metric label="Pessoas ativas" value="4" hint="pessoas na equipe" tone="blush" />
        <Metric label="Na agenda" value="3" hint="quem recebe reservas" tone="green" />
        <Metric label="Serviços por profissional" value="7" hint="o que cada pessoa faz" tone="ivory" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 8, marginBottom: 8 }}>
        <section style={panelStyle({ padding: 14, background: "rgba(243,196,194,0.35)" })}>
          <h3 style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 18 }}>Vagas de profissionais</h3>
          <p style={{ margin: "8px 0 0", fontFamily: theme.fontSerif, fontSize: 32, color: theme.wineDeep }}>3 de 5</p>
          <p style={{ margin: 0, fontSize: 12, color: theme.muted }}>profissionais utilizados neste plano</p>
        </section>
        <section style={panelStyle({ padding: 14 })}>
          <h3 style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 18 }}>Convidar para a equipe</h3>
          <p style={{ margin: "4px 0 10px", fontSize: 12, color: theme.muted }}>Função na equipe: Profissional</p>
          <span style={{ display: "inline-flex", height: 36, alignItems: "center", borderRadius: 999, background: theme.wine, color: "#fffaf8", padding: "0 14px", fontSize: 13, fontWeight: 700 }}>
            Gerar convite
          </span>
        </section>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {team.map((member) => (
          <article key={member.name} style={panelStyle({ padding: 12 })}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Initials value={member.initials} size={36} />
              <div>
                <p style={{ margin: 0, fontWeight: 750 }}>{member.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: theme.muted }}>{member.services}</p>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 11, borderRadius: 999, background: theme.metricBlush, padding: "4px 8px", fontWeight: 700 }}>{member.role}</span>
              <span style={{ fontSize: 11, borderRadius: 999, border: `1px solid ${theme.border}`, padding: "4px 8px" }}>{member.status}</span>
              <span style={{ fontSize: 11, color: theme.muted }}>{member.booking}</span>
            </div>
          </article>
        ))}
      </div>
    </AdminChrome>
  );
}

export function StockScreen() {
  return (
    <AdminChrome active="Estoque">
      <PageHeading eyebrow="Produtos e consumo" title="Estoque" description="Enxergue o que entra, o que sai e o que precisa de reposição." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
        <Metric label="Produtos" value="3" hint="cadastrados e ativos" tone="blush" />
        <Metric label="Estoque baixo" value="1" hint="precisa repor em breve" tone="sand" />
        <Metric label="Custo em estoque" value="R$ 756,00" hint="estimativa do que está na prateleira" tone="ivory" />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {stock.map((product) => (
          <article key={product.name} style={panelStyle({ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", background: product.state === "Normal" ? "#fff" : theme.metricSand })}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>{product.name}</h3>
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>{product.detail}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: theme.muted }}>{product.cost}</p>
            </div>
            <StatusChip status={product.state} />
          </article>
        ))}
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 12, color: theme.muted }}>Histórico recente · Shampoo botânico · Chegou produto · +12</p>
    </AdminChrome>
  );
}

export function FinanceScreen() {
  return (
    <AdminChrome active="Financeiro">
      <PageHeading eyebrow="Dinheiro do salão" title="Financeiro" description="Anote o que entrou, o que saiu e o que ainda falta pagar." />
      <div style={{ ...panelStyle({ padding: "10px 12px", marginBottom: 10 }), display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: theme.muted }}>Período</span>
        <span style={{ height: 32, borderRadius: 10, border: `1px solid ${theme.border}`, background: "#fff", padding: "0 10px", display: "inline-flex", alignItems: "center", fontSize: 13, fontWeight: 650 }}>
          Este mês
        </span>
        <span style={{ height: 32, borderRadius: 10, background: theme.wine, color: "#fffaf8", padding: "0 12px", display: "inline-flex", alignItems: "center", fontSize: 13, fontWeight: 700 }}>
          Mostrar
        </span>
        <span style={{ fontSize: 12, color: theme.muted }}>01/10/2026 a 20/10/2026</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
        <Metric label="Dinheiro que entrou" value="R$ 8.640,00" hint="já recebido neste período" tone="green" />
        <Metric label="Dinheiro que saiu" value="R$ 2.180,00" hint="já pago neste período" tone="blush" />
        <Metric label="Ainda em aberto" value="R$ 960,00" hint="falta entrar ou sair" tone="sand" />
        <Metric label="Quanto sobrou" value="R$ 6.460,00" hint="entradas menos saídas" tone="ivory" />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {financeEntries.map((entry) => (
          <article key={entry.title + entry.status} style={{ ...panelStyle({ padding: "12px 14px" }), borderLeft: `4px solid ${entry.kind === "income" ? theme.confirmedFg : theme.wine}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>{entry.title}</h3>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: theme.muted }}>{entry.meta}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong>{entry.amount}</strong>
                <div style={{ marginTop: 4 }}>
                  <StatusChip status={entry.status} />
                </div>
              </div>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12 }}>{entry.extra}</p>
          </article>
        ))}
      </div>
    </AdminChrome>
  );
}
