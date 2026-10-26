import React from "react";
import { C } from "../theme";
import { fontSans, fontSerif } from "../fonts";
import { Avatar, Chip, RoseButton } from "./ui";
import { FloralSprig } from "./floral";
import { BOOKING, CLIENT, PROS, SALON, SERVICES } from "../demo-data";

const STEPS = ["Serviço", "Profissional", "Data", "Horário", "Seus dados", "Confirmar"] as const;

export function StepBar({ current }: { current: number }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
        {STEPS.map((label, index) => (
          <div key={label}>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: index <= current ? C.wine : C.border,
              }}
            />
            <p
              style={{
                margin: "4px 0 0",
                textAlign: "center",
                fontSize: 9,
                fontWeight: 600,
                fontFamily: fontSans,
                color: index === current ? C.wineDeep : C.muted,
                lineHeight: 1.15,
              }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>
      <p style={{ margin: "12px 0 0", fontFamily: fontSans, fontSize: 16, fontWeight: 600, color: C.ink }}>
        Passo {current + 1} de 6: {["Escolha o serviço", "Escolha quem atende", "Escolha o dia", "Escolha o horário", "Confira seus dados", "Confirme a reserva"][current]}
      </p>
    </div>
  );
}

export function BookingHeader() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.wine,
            fontFamily: fontSans,
          }}
        >
          {SALON.name}
        </p>
        <h1 style={{ margin: "6px 0 0", fontFamily: fontSerif, fontSize: 30, lineHeight: 1.05, color: C.wineDeep, fontWeight: 500 }}>
          Agendar horário
        </h1>
      </div>
      <FloralSprig style={{ width: 42, height: 68, flexShrink: 0 }} />
    </div>
  );
}

export function Chosen({
  service,
  pro,
  date,
}: {
  service?: boolean;
  pro?: boolean;
  date?: boolean;
}) {
  if (!service) return null;
  return (
    <div
      style={{
        borderRadius: 20,
        background: C.paper,
        padding: 14,
        border: `1px solid ${C.ring}`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: C.roseInk,
          fontFamily: fontSans,
        }}
      >
        Você escolheu
      </p>
      <p style={{ margin: "8px 0 0", fontFamily: fontSans, fontSize: 13, lineHeight: 1.5, color: C.ink }}>
        <span style={{ color: C.muted }}>Serviço: </span>
        <span style={{ fontWeight: 600, color: C.wineDeep }}>{SERVICES[0].name}</span>
        {" · "}
        {SERVICES[0].minutes} min · {SERVICES[0].price}
      </p>
      {pro ? (
        <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 13, color: C.ink }}>
          <span style={{ color: C.muted }}>Profissional: </span>
          <span style={{ fontWeight: 600 }}>{PROS[0].name}</span>
        </p>
      ) : null}
      {date ? (
        <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 13, color: C.ink }}>
          <span style={{ color: C.muted }}>Dia: </span>
          <span style={{ fontWeight: 600 }}>{BOOKING.dateLabel}</span>
        </p>
      ) : null}
    </div>
  );
}

export function ServiceList({ selected }: { selected: boolean }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {SERVICES.map((item, index) => {
        const on = selected && index === 0;
        return (
          <div
            key={item.id}
            style={{
              borderRadius: 20,
              padding: 16,
              background: on ? C.metricBlush : C.paper,
              border: `1px solid ${on ? C.roseInk : C.ring}`,
              transform: on ? "scale(1.015)" : "scale(1)",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontFamily: fontSerif, fontSize: 20, color: C.wineDeep, fontWeight: 500, paddingRight: 8 }}>
                {item.name}
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted, fontFamily: fontSans }}>{item.description}</p>
              <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 600, color: C.wineDeep, fontFamily: fontSans }}>
                {item.price}
              </p>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: C.muted, fontFamily: fontSans }}>{item.minutes} minutos</p>
          </div>
        );
      })}
    </div>
  );
}

export function ProfessionalList({ selected }: { selected: boolean }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {PROS.map((person, index) => {
        const on = selected && index === 0;
        return (
          <div
            key={person.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderRadius: 20,
              padding: 12,
              background: on ? C.metricBlush : C.cream,
              border: `1px solid ${on ? C.roseInk : C.ring}`,
            }}
          >
            <Avatar initials={person.initials} size={48} />
            <div>
              <p style={{ margin: 0, fontFamily: fontSans, fontWeight: 600, color: C.ink, fontSize: 16 }}>{person.name}</p>
              <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 12, color: C.muted }}>{person.role}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DateGrid({ selected }: { selected: boolean }) {
  const days = [19, 20, 21, 22, 23, 24, 25];
  return (
    <div>
      <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: 13, color: C.muted }}>
        Toque no dia que você quer. Mostramos os próximos 14 dias com horários livres.
      </p>
      <div
        style={{
          borderRadius: 20,
          background: C.paper,
          padding: 14,
          border: `1px solid ${C.ring}`,
        }}
      >
        <p style={{ margin: "0 0 10px", fontFamily: fontSerif, fontSize: 20, color: C.wineDeep }}>Outubro 2026</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d) => (
            <span key={d} style={{ textAlign: "center", fontSize: 11, color: C.muted, fontFamily: fontSans }}>
              {d}
            </span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {days.map((day) => {
            const on = selected && day === 22;
            return (
              <div
                key={day}
                style={{
                  height: 42,
                  borderRadius: 14,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: fontSans,
                  fontSize: 14,
                  fontWeight: 600,
                  background: on ? C.wine : C.paper,
                  color: on ? C.white : C.ink,
                  border: `1px solid ${on ? C.wine : C.border}`,
                }}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SlotGrid({ selected }: { selected: boolean }) {
  return (
    <div>
      <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: C.ink }}>
        Horários para {BOOKING.dateLabel}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {BOOKING.slots.map((slot) => {
          const on = selected && slot === BOOKING.time;
          return (
            <div
              key={slot}
              style={{
                height: 46,
                borderRadius: 16,
                display: "grid",
                placeItems: "center",
                background: on ? C.wine : C.paper,
                color: on ? C.white : C.ink,
                border: `1px solid ${on ? C.wine : C.border}`,
                fontFamily: fontSans,
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              {slot}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConfirmCard() {
  const rows = [
    ["Salão", SALON.name],
    ["Serviço", SERVICES[0].name],
    ["Profissional", PROS[0].name],
    ["Quando", `Qui, 22 de outubro · ${BOOKING.time}`],
    ["Duração", `${SERVICES[0].minutes} minutos`],
    ["Valor", SERVICES[0].price],
  ];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          borderRadius: 24,
          background: C.paper,
          padding: "6px 16px 8px",
          border: `1px solid ${C.border}`,
        }}
      >
        {rows.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "11px 0",
              borderBottom: `1px solid ${C.border}99`,
              fontFamily: fontSans,
            }}
          >
            <span style={{ color: C.muted, fontSize: 13 }}>{label}</span>
            <span style={{ color: C.ink, fontSize: 13, fontWeight: 600, textAlign: "right" }}>{value}</span>
          </div>
        ))}
      </div>
      <RoseButton>Reservar este horário</RoseButton>
    </div>
  );
}

export function SuccessCard() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          borderRadius: 28,
          background: C.paper,
          padding: 22,
          textAlign: "center",
          border: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            margin: "0 auto",
            width: 56,
            height: 56,
            borderRadius: 999,
            background: C.metricBlush,
            color: C.roseInk,
            display: "grid",
            placeItems: "center",
            fontFamily: fontSerif,
            fontSize: 28,
          }}
        >
          ✓
        </div>
        <h2 style={{ margin: "12px 0 0", fontFamily: fontSerif, fontSize: 30, color: C.wineDeep, lineHeight: 1.1 }}>
          Agendamento confirmado!
        </h2>
        <p style={{ margin: "8px 0 0", fontFamily: fontSans, fontSize: 13, color: C.muted, lineHeight: 1.45 }}>
          O salão confirmou seu horário. Confira os detalhes abaixo.
        </p>
        <div style={{ marginTop: 12 }}>
          <Chip tone="confirmed">Confirmado</Chip>
        </div>
      </div>
      <div
        style={{
          borderRadius: 24,
          background: C.paper,
          padding: 16,
          border: `1px solid ${C.border}`,
          fontFamily: fontSans,
          fontSize: 13,
          color: C.ink,
        }}
      >
        <p style={{ margin: 0 }}>
          <span style={{ color: C.muted }}>Cliente: </span>
          {CLIENT.name}
        </p>
        <p style={{ margin: "6px 0 0" }}>
          <span style={{ color: C.muted }}>Quando: </span>
          Qui, 22/10 · {BOOKING.time}–{BOOKING.end}
        </p>
        <p style={{ margin: "6px 0 0" }}>
          <span style={{ color: C.muted }}>Com: </span>
          {PROS[0].name}
        </p>
      </div>
    </div>
  );
}
