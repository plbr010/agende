import React from "react";
import { C, shadowPhone } from "../theme";
import { fontSans, fontSerif } from "../fonts";
import { BrandWord, IconCalendar, IconHouse, IconMenu, IconUsers } from "./ui";
import { FloralSprig } from "./floral";

export function StageBloom() {
  return (
    <>
      <div
        style={{
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: 999,
          background: C.blush,
          filter: "blur(90px)",
          opacity: 0.38,
          top: -80,
          left: -60,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 380,
          height: 380,
          borderRadius: 999,
          background: C.peach,
          filter: "blur(90px)",
          opacity: 0.32,
          bottom: 80,
          right: -80,
        }}
      />
      <FloralSprig
        style={{
          position: "absolute",
          top: 36,
          right: 28,
          width: 92,
          height: 150,
          opacity: 0.88,
        }}
      />
    </>
  );
}

export function Phone({
  children,
  width,
  height,
  url,
}: {
  children: React.ReactNode;
  width: number;
  height: number;
  url?: string;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 52,
        padding: 12,
        background: "linear-gradient(180deg,#3a1a26 0%,#1d1016 100%)",
        boxShadow: shadowPhone,
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 42,
          overflow: "hidden",
          background: C.cream,
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 22px",
            fontFamily: fontSans,
            fontSize: 12,
            fontWeight: 600,
            color: C.wineDeep,
            background: "rgba(251,244,238,0.92)",
          }}
        >
          <span>9:41</span>
          <div style={{ width: 86, height: 16, borderRadius: 999, background: "#1d1016" }} />
          <span style={{ letterSpacing: 1 }}>●●●</span>
        </div>
        {url ? (
          <div
            style={{
              margin: "0 14px 8px",
              height: 30,
              borderRadius: 999,
              background: C.paper,
              border: `1px solid ${C.ring}`,
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
              fontFamily: fontSans,
              fontSize: 12,
              color: C.muted,
              overflow: "hidden",
            }}
          >
            {url}
          </div>
        ) : null}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
      </div>
    </div>
  );
}

export function AppChrome({
  children,
  active,
  salon = "Studio Pétala",
  role = "Proprietária",
}: {
  children: React.ReactNode;
  active: "inicio" | "agenda" | "clientes" | "mais";
  salon?: string;
  role?: string;
}) {
  const items = [
    { id: "inicio" as const, label: "Início", icon: <IconHouse /> },
    { id: "agenda" as const, label: "Agenda", icon: <IconCalendar /> },
    { id: "clientes" as const, label: "Clientes", icon: <IconUsers /> },
    { id: "mais" as const, label: "Mais", icon: <IconMenu /> },
  ];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: C.canvas,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: 58,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          borderBottom: `1px solid ${C.border}`,
          background: "rgba(250,243,238,0.92)",
        }}
      >
        <div
          style={{
            height: 36,
            padding: "0 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: C.wineDeep,
            fontFamily: fontSans,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <IconMenu /> Menu
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: fontSerif, fontSize: 17, color: C.wineDeep, lineHeight: 1 }}>{salon}</p>
          <p style={{ margin: "3px 0 0", fontFamily: fontSans, fontSize: 11, color: C.muted }}>{role}</p>
        </div>
        <div
          style={{
            height: 36,
            padding: "0 8px",
            display: "flex",
            alignItems: "center",
            color: C.wineDeep,
            fontFamily: fontSans,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Novo
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "12px 14px 8px" }}>{children}</div>
      <div
        style={{
          height: 64,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          borderTop: `1px solid ${C.border}`,
          background: "rgba(255,255,255,0.96)",
        }}
      >
        {items.map((item) => {
          const on = item.id === active;
          return (
            <div
              key={item.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                color: on ? C.wineDeep : C.muted,
                fontFamily: fontSans,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {item.icon}
              {item.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BookingChrome({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg,#f8e4df 0%,#fbf4ee 38%,#fbf4ee 100%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: `1px solid ${C.border}`,
          background: "rgba(251,244,238,0.86)",
        }}
      >
        <BrandWord size={22} />
        <span style={{ fontFamily: fontSans, fontSize: 13, color: C.ink, textDecoration: "underline" }}>
          Voltar ao salão
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: "14px 16px 18px", position: "relative" }}>{children}</div>
    </div>
  );
}
