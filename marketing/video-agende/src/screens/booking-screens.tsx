import { interpolate, useCurrentFrame } from "remotion";
import { client, professionals, salon, services, slots } from "../fixtures";
import { theme } from "../theme";
import { FloralSprig } from "../components/stage";
import { Initials, PhoneHeader, PhonePage, StatusChip } from "../components/product";

const STEPS = ["Serviço", "Profissional", "Data", "Horário", "Dados", "Confirmar"];

function Steps({ current }: { current: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
      {STEPS.map((label, index) => (
        <div key={label}>
          <div style={{ height: 5, borderRadius: 99, background: index <= current ? theme.wine : theme.border }} />
          <span style={{ display: "block", marginTop: 4, fontSize: 9, fontWeight: 650, color: index === current ? theme.wineDeep : theme.muted, whiteSpace: "nowrap", overflow: "hidden" }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Chosen({ lines }: { lines: string[] }) {
  return (
    <section style={{ background: "#fff", borderRadius: 18, padding: "10px 12px", border: `1px solid ${theme.softRing}` }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 750, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.roseInk }}>
        Você escolheu
      </p>
      {lines.map((line) => (
        <p key={line} style={{ margin: "4px 0 0", fontSize: 13, color: theme.foreground }}>
          {line}
        </p>
      ))}
    </section>
  );
}

export function SalonScreen({ tap }: { tap?: boolean }) {
  const frame = useCurrentFrame();
  const ring = tap ? interpolate(frame % 36, [0, 18, 36], [0.35, 1, 0.35]) : 0;

  return (
    <PhonePage>
      <PhoneHeader action="Agendar" />
      <div style={{ padding: "14px 14px 20px" }}>
        <div style={{ background: "#fff", borderRadius: 28, overflow: "hidden", border: `1px solid ${theme.softRing}` }}>
          <div
            style={{
              height: 132,
              background: "linear-gradient(135deg, #f8e4df, #fbf4ee 46%, rgba(232,180,160,0.85))",
              position: "relative",
            }}
          >
            <FloralSprig style={{ position: "absolute", right: 12, bottom: 8, width: 54, height: 86, opacity: 0.85 }} />
          </div>
          <div style={{ padding: "0 16px 16px" }}>
            <div
              style={{
                width: 64,
                height: 64,
                marginTop: -32,
                borderRadius: 20,
                background: theme.wineDeep,
                color: theme.cream,
                display: "grid",
                placeItems: "center",
                fontFamily: theme.fontSerif,
                fontSize: 30,
                boxShadow: "0 16px 40px -24px rgba(92,26,46,0.65)",
                border: "4px solid #fff",
              }}
            >
              A
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 11, fontWeight: 750, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.roseInk }}>
              {salon.city}
            </p>
            <h2 style={{ margin: "4px 0 0", fontFamily: theme.fontSerif, fontSize: 32, fontWeight: 500, color: theme.wineDeep, letterSpacing: "-0.03em" }}>
              {salon.name}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: theme.muted }}>{salon.address}</p>
            <p style={{ margin: "10px 0 0", display: "inline-flex", gap: 6, alignItems: "center", background: theme.metricBlush, color: theme.wineDeep, borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 650 }}>
              ★ {salon.rating}
              <span style={{ color: theme.muted, fontWeight: 500 }}>{salon.reviews}</span>
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.45 }}>{salon.description}</p>
          </div>
        </div>

        <p style={{ margin: "16px 0 0", fontSize: 11, fontWeight: 750, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.roseInk }}>
          Serviços
        </p>
        <h3 style={{ margin: "2px 0 10px", fontFamily: theme.fontSerif, fontSize: 26, fontWeight: 500, color: theme.wineDeep }}>O que oferecemos</h3>
        <article style={{ background: "#fff", borderRadius: 20, padding: 14, border: `1px solid ${theme.softRing}`, position: "relative" }}>
          <h4 style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 22, color: theme.wineDeep }}>{services[0].name}</h4>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: theme.muted }}>{services[0].minutes} minutos</p>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: 14 }}>{services[0].price}</strong>
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
                boxShadow: tap ? `0 0 0 ${4 + ring * 6}px rgba(196,93,124,${0.25 + ring * 0.25})` : undefined,
              }}
            >
              Agendar
            </span>
          </div>
        </article>
      </div>
    </PhonePage>
  );
}

export function ServiceScreen({ selected }: { selected: boolean }) {
  return (
    <PhonePage>
      <PhoneHeader />
      <div style={{ padding: "16px 14px 24px", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.wine }}>{salon.name}</p>
            <h2 style={{ margin: "2px 0 0", fontFamily: theme.fontSerif, fontSize: 30, fontWeight: 500, color: theme.wineDeep }}>Agendar horário</h2>
          </div>
          <FloralSprig style={{ width: 40, height: 64 }} />
        </div>
        <Steps current={0} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>Escolha o serviço</p>
        {services.map((service, index) => {
          const on = selected && index === 0;
          return (
            <article
              key={service.name}
              style={{
                background: on ? theme.metricBlush : "#fff",
                borderRadius: 20,
                padding: 14,
                border: `2px solid ${on ? theme.wine : theme.softRing}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <h3 style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 22, color: theme.wineDeep }}>{service.name}</h3>
                <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>{service.price}</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: theme.muted }}>{service.description}</p>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: theme.muted }}>{service.minutes} minutos</p>
            </article>
          );
        })}
      </div>
    </PhonePage>
  );
}

export function ProfessionalScreen() {
  return (
    <PhonePage>
      <PhoneHeader />
      <div style={{ padding: "16px 14px", display: "grid", gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.wine }}>{salon.name}</p>
          <h2 style={{ margin: "2px 0 0", fontFamily: theme.fontSerif, fontSize: 30, fontWeight: 500, color: theme.wineDeep }}>Agendar horário</h2>
        </div>
        <Steps current={1} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>Escolha quem atende</p>
        <Chosen lines={["Serviço: Corte e escova · 70 min · R$ 180,00"]} />
        <article style={{ background: "rgba(243,196,194,0.45)", borderRadius: 22, padding: 14, border: `1px solid ${theme.border}` }}>
          <h3 style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 20 }}>Qualquer profissional disponível</h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: theme.muted }}>Mostramos um horário livre, com quem puder atender.</p>
        </article>
        {professionals.slice(0, 2).map((person, index) => (
          <article
            key={person.name}
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 12,
              border: `1px solid ${index === 0 ? theme.wine : theme.softRing}`,
              display: "flex",
              gap: 12,
              alignItems: "center",
              boxShadow: index === 0 ? "0 0 0 3px rgba(107,45,66,0.12)" : undefined,
            }}
          >
            <Initials value={person.initials} />
            <div>
              <h3 style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 22 }}>{person.name}</h3>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: theme.muted }}>{person.role}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>{person.price} · {person.minutes} min</p>
            </div>
          </article>
        ))}
      </div>
    </PhonePage>
  );
}

export function DateScreen() {
  const days = ["D", "S", "T", "Q", "Q", "S", "S"];
  const leadingBlanks = 4;
  const cells = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: 31 }, (_, index) => index + 1),
  ];
  return (
    <PhonePage>
      <PhoneHeader />
      <div style={{ padding: "16px 14px", display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 30, fontWeight: 500, color: theme.wineDeep }}>Agendar horário</h2>
        <Steps current={2} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>Escolha o dia</p>
        <Chosen lines={["Serviço: Corte e escova · 70 min · R$ 180,00", "Profissional: Helena Duarte"]} />
        <h3 style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 24 }}>Outubro de 2026</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center" }}>
          {days.map((day, index) => (
            <span key={`${day}-${index}`} style={{ fontSize: 11, color: theme.muted }}>{day}</span>
          ))}
          {cells.map((day, index) => (
            <span
              key={index}
              style={{
                height: 36,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                fontSize: 13,
                fontWeight: day === 20 ? 700 : 500,
                background: day === 20 ? theme.wineDeep : "transparent",
                color: day === 20 ? "#fffaf8" : day ? theme.foreground : "transparent",
              }}
            >
              {day ?? ""}
            </span>
          ))}
        </div>
      </div>
    </PhonePage>
  );
}

export function SlotScreen({ selected }: { selected: boolean }) {
  return (
    <PhonePage>
      <PhoneHeader />
      <div style={{ padding: "16px 14px", display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 30, fontWeight: 500, color: theme.wineDeep }}>Agendar horário</h2>
        <Steps current={3} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>Escolha o horário</p>
        <Chosen lines={["Serviço: Corte e escova · 70 min · R$ 180,00", "Profissional: Helena Duarte", "Dia: 20/10/2026"]} />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>Horários para 20/10/2026</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {slots.map((slot) => {
            const on = selected && slot === "14:30";
            return (
              <span
                key={slot}
                style={{
                  height: 46,
                  borderRadius: 16,
                  background: on ? theme.wineDeep : "#fff",
                  color: on ? "#fffaf8" : theme.foreground,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 14,
                  fontWeight: 650,
                  border: `1px solid ${on ? theme.wineDeep : theme.border}`,
                }}
              >
                {slot}
              </span>
            );
          })}
        </div>
      </div>
    </PhonePage>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
      <span style={{ fontSize: 13, color: theme.muted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 650, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function ConfirmScreen({ phase }: { phase: "summary" | "reserving" | "done" }) {
  if (phase === "done") {
    return (
      <PhonePage>
        <PhoneHeader />
        <div style={{ padding: "18px 14px", display: "grid", gap: 12 }}>
          <section style={{ background: "#fff", borderRadius: 28, padding: "22px 16px", textAlign: "center", border: `1px solid ${theme.border}` }}>
            <span style={{ width: 58, height: 58, margin: "0 auto", borderRadius: 999, background: theme.metricBlush, color: theme.roseInk, display: "grid", placeItems: "center", fontSize: 28 }}>
              ✓
            </span>
            <h2 style={{ margin: "12px 0 0", fontFamily: theme.fontSerif, fontSize: 30, fontWeight: 500, color: theme.wineDeep, lineHeight: 1.05 }}>
              Solicitação recebida
            </h2>
            <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.45, color: theme.muted }}>
              Aguardando confirmação do salão. O horário foi registrado e ainda não está confirmado.
            </p>
            <div style={{ marginTop: 12 }}>
              <StatusChip status="Aguardando confirmação" />
            </div>
          </section>
          <section style={{ background: "#fff", borderRadius: 24, padding: "6px 14px", border: `1px solid ${theme.border}` }}>
            <SummaryLine label="Status" value="Aguardando confirmação" />
            <SummaryLine label="Salão" value={salon.name} />
            <SummaryLine label="Serviço" value="Corte e escova" />
            <SummaryLine label="Profissional" value="Helena Duarte" />
            <SummaryLine label="Quando" value="20/10 · 14:30" />
            <SummaryLine label="Duração" value="70 minutos" />
            <SummaryLine label="Valor" value="R$ 180,00" />
          </section>
        </div>
      </PhonePage>
    );
  }

  return (
    <PhonePage>
      <PhoneHeader />
      <div style={{ padding: "16px 14px", display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontFamily: theme.fontSerif, fontSize: 30, fontWeight: 500, color: theme.wineDeep }}>Agendar horário</h2>
        <Steps current={5} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>Confirme a reserva</p>
        <section style={{ background: "#fff", borderRadius: 24, padding: "4px 14px 8px", border: `1px solid ${theme.border}` }}>
          <SummaryLine label="Serviço" value="Corte e escova" />
          <SummaryLine label="Profissional" value="Helena Duarte" />
          <SummaryLine label="Quando" value={salon.whenLabel} />
          <SummaryLine label="Duração" value="70 minutos" />
          <SummaryLine label="Valor" value="R$ 180,00" />
          <SummaryLine label="Nome" value={client.name} />
        </section>
        <div
          style={{
            height: 48,
            borderRadius: 999,
            background: theme.wine,
            color: "#fffaf8",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            transform: phase === "reserving" ? "scale(0.98)" : "scale(1)",
          }}
        >
          {phase === "reserving" ? "Reservando…" : "Reservar este horário"}
        </div>
      </div>
    </PhonePage>
  );
}
