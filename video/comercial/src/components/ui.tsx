import React from "react";
import { Img, staticFile } from "remotion";
import { C, shadowSoft } from "../theme";
import { fontSans, fontSerif } from "../fonts";

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <Img
      src={staticFile("logo-mark.png")}
      style={{
        width: size,
        height: size,
        borderRadius: "22%",
        boxShadow: "0 8px 18px -12px rgb(92 26 46 / 0.55)",
        objectFit: "cover",
      }}
    />
  );
}

export function BrandWord({
  size = 28,
  tone = "dark",
}: {
  size?: number;
  tone?: "dark" | "light";
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: fontSerif,
        fontSize: size,
        letterSpacing: -0.6,
        color: tone === "light" ? C.white : C.wineDeep,
        lineHeight: 1,
      }}
    >
      <BrandMark size={Math.round(size * 1.15)} />
      <span>
        Agend
        <span style={{ fontStyle: "italic", color: tone === "light" ? C.blush : C.roseInk }}>ê</span>
      </span>
    </div>
  );
}

export function Avatar({
  initials,
  size = 40,
}: {
  initials: string;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: C.metricBlush,
        color: C.wineDeep,
        fontFamily: fontSerif,
        fontSize: size * 0.36,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

export function Chip({
  children,
  tone = "scheduled",
}: {
  children: React.ReactNode;
  tone?: "scheduled" | "confirmed";
}) {
  const bg = tone === "confirmed" ? C.confirmedBg : C.scheduledBg;
  const fg = tone === "confirmed" ? C.confirmedFg : C.scheduledFg;
  return (
    <span
      style={{
        display: "inline-flex",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: fontSans,
        background: bg,
        color: fg,
      }}
    >
      {children}
    </span>
  );
}

export function RoseButton({
  children,
  variant = "rose",
}: {
  children: React.ReactNode;
  variant?: "rose" | "wine" | "outline";
}) {
  const bg = variant === "rose" ? C.rose : variant === "wine" ? C.wine : C.paper;
  const color = variant === "outline" ? C.wineDeep : C.white;
  return (
    <div
      style={{
        height: 48,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        background: bg,
        color,
        fontFamily: fontSans,
        fontWeight: 600,
        fontSize: 16,
        boxShadow: variant === "outline" ? "none" : "0 10px 24px -16px var(--wine, #6b2d42)",
        border: variant === "outline" ? `1px solid ${C.border}` : "none",
      }}
    >
      {children}
    </div>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "blush",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "blush" | "sand" | "ivory" | "lilac" | "success";
}) {
  const wash = {
    blush: C.metricBlush,
    sand: C.metricSand,
    ivory: C.metricIvory,
    lilac: C.metricLilac,
    success: C.confirmedBg,
  }[tone];
  return (
    <div
      style={{
        minHeight: 86,
        borderRadius: 20,
        padding: 14,
        background: wash,
        boxShadow: shadowSoft,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: C.muted, fontFamily: fontSans }}>{label}</p>
      <p
        style={{
          margin: "10px 0 0",
          fontFamily: fontSerif,
          fontSize: 28,
          lineHeight: 1,
          color: C.wineDeep,
          letterSpacing: -0.4,
        }}
      >
        {value}
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.4, color: C.muted, fontFamily: fontSans }}>{hint}</p>
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div
      style={{
        borderRadius: 24,
        padding: 18,
        background: C.paper,
        boxShadow: "0 1px 0 rgba(255,255,255,0.8)",
        border: `1px solid ${C.ring}`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: C.wineDeep,
          fontFamily: fontSans,
        }}
      >
        {eyebrow}
      </p>
      <h2
        style={{
          margin: "6px 0 0",
          fontFamily: fontSerif,
          fontSize: 32,
          lineHeight: 1,
          color: C.wineDeep,
          fontWeight: 500,
        }}
      >
        {title}
      </h2>
      {description ? (
        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.45, color: C.muted, fontFamily: fontSans }}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function Caption({
  text,
  opacity,
  compact = false,
}: {
  text: string;
  opacity: number;
  compact?: boolean;
}) {
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        opacity,
        background: "rgba(255,250,248,0.94)",
        border: `1px solid ${C.ring}`,
        borderRadius: 28,
        padding: compact ? "16px 22px" : "22px 28px",
        boxShadow: "0 20px 50px -28px rgb(92 26 46 / 0.45)",
        textAlign: "center",
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: fontSerif,
          fontSize: compact ? 26 : 34,
          lineHeight: 1.2,
          color: C.wineDeep,
        }}
      >
        {text}
      </p>
    </div>
  );
}

export function Pointer({
  x,
  y,
  pressed,
  opacity = 1,
}: {
  x: number;
  y: number;
  pressed: number;
  opacity?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 1,
        height: 1,
        pointerEvents: "none",
        opacity,
        zIndex: 20,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -36,
          top: -36,
          width: 72,
          height: 72,
          borderRadius: 999,
          border: `2px solid rgba(196,93,124,${0.45 + pressed * 0.4})`,
          background: `rgba(196,93,124,${0.16 + pressed * 0.18})`,
          transform: `scale(${0.7 + pressed * 0.55})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -8,
          top: -8,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: C.rose,
          boxShadow: "0 6px 16px -6px rgb(92 26 46 / 0.7)",
          transform: `scale(${1 - pressed * 0.12})`,
        }}
      />
    </div>
  );
}

export function IconHouse() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}
export function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </svg>
  );
}
export function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S14 16 14.5 19" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 14.6c2.2.3 3.8 1.6 4.4 4.4" />
    </svg>
  );
}
export function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
