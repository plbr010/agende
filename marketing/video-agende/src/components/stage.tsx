import { AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { theme } from "../theme";
import { BrandFonts } from "../fonts";

export function Backdrop() {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 70) * 18;

  return (
    <AbsoluteFill style={{ background: theme.cream, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: 980,
          height: 760,
          left: -180 + drift,
          top: -240,
          background: "radial-gradient(circle, rgba(243,196,194,0.95), transparent 68%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 860,
          height: 640,
          right: -200,
          top: -120 - drift,
          background: "radial-gradient(circle, rgba(232,180,160,0.62), transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 220px rgba(92, 26, 46, 0.07)",
        }}
      />
    </AbsoluteFill>
  );
}

export function Wordmark({
  size = 28,
  light = false,
  mark = true,
}: {
  size?: number;
  light?: boolean;
  mark?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size * 0.28,
        fontFamily: theme.fontSerif,
        fontSize: size,
        lineHeight: 1,
        color: light ? "#fffaf8" : theme.wineDeep,
        letterSpacing: "-0.03em",
      }}
    >
      {mark ? (
        <img
          src={staticFile("brand/logo-mark.png")}
          alt=""
          style={{
            width: size * 0.92,
            height: size * 0.92,
            borderRadius: size * 0.22,
            boxShadow: "0 8px 18px -12px rgba(92, 26, 46, 0.55)",
          }}
        />
      ) : null}
      <span>
        Agend
        <span style={{ fontStyle: "italic", color: light ? "#f3c4c2" : theme.roseInk }}>ê</span>
      </span>
    </div>
  );
}

export function FloralSprig({ style }: { style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 160 260" style={{ width: 48, height: 78, ...style }}>
      <path d="M82 248C90 190 78 140 70 92c-6-36 8-70 22-98" stroke={theme.rose} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse cx="58" cy="150" rx="16" ry="28" fill={theme.peach} transform="rotate(-40 58 150)" />
      <ellipse cx="104" cy="118" rx="16" ry="28" fill={theme.blush} transform="rotate(36 104 118)" />
      <ellipse cx="70" cy="86" rx="13" ry="22" fill={theme.rose} transform="rotate(-20 70 86)" />
      <circle cx="96" cy="28" r="7" fill={theme.wine} />
      <circle cx="96" cy="26" r="2.2" fill="#f8e4df" />
    </svg>
  );
}

export function SceneStage({
  kicker,
  title,
  callout,
  children,
}: {
  kicker: string;
  title: string;
  callout: string;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 90, mass: 0.9 } });
  const push = interpolate(frame, [0, durationInFrames], [0.97, 1.025], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ fontFamily: theme.fontSans, color: theme.foreground }}>
      <div
        style={{
          position: "absolute",
          left: 84,
          top: "46%",
          width: 500,
          opacity: enter,
          transform: `translateY(calc(-50% + ${(1 - enter) * 28}px))`,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 650,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: theme.roseInk,
          }}
        >
          {kicker}
        </p>
        <h1
          style={{
            margin: "18px 0 0",
            fontFamily: theme.fontSerif,
            fontWeight: 500,
            fontSize: 72,
            lineHeight: 0.96,
            letterSpacing: "-0.03em",
            color: theme.wineDeep,
            whiteSpace: "pre-line",
          }}
        >
          {title}
        </h1>
        <div
          style={{
            marginTop: 28,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            borderRadius: 999,
            background: "rgba(255,255,255,0.78)",
            color: theme.wineDeep,
            padding: "12px 18px",
            fontSize: 18,
            fontWeight: 600,
            boxShadow: "0 10px 30px -22px rgba(92,26,46,0.8)",
            border: `1px solid ${theme.softRing}`,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: theme.rose,
            }}
          />
          {callout}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 64,
          top: 64,
          bottom: 108,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${push})`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}

export function Caption({ text }: { text: string }) {
  const frame = useCurrentFrame();
  if (!text) return null;
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 34,
        display: "flex",
        justifyContent: "center",
        opacity,
        zIndex: 5,
      }}
    >
      <p
        style={{
          margin: 0,
          maxWidth: 980,
          borderRadius: 999,
          background: "rgba(92, 26, 46, 0.92)",
          color: "#fffaf8",
          padding: "14px 28px",
          fontFamily: theme.fontSans,
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: "-0.02em",
        }}
      >
        {text}
      </p>
    </div>
  );
}

export function PhoneMockup({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: 390,
        height: 800,
        borderRadius: 52,
        padding: 12,
        background: "linear-gradient(165deg, #4a2c38, #1c1218 58%)",
        boxShadow: "0 46px 90px -40px rgba(92,26,46,0.62), 0 0 0 1px rgba(255,255,255,0.12)",
      }}
    >
      <div
        style={{
          position: "relative",
          height: "100%",
          borderRadius: 40,
          overflow: "hidden",
          background: theme.cream,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            zIndex: 4,
            width: 112,
            height: 24,
            transform: "translateX(-50%)",
            borderRadius: 20,
            background: "#1c1218",
          }}
        />
        {children}
      </div>
    </div>
  );
}

export function LaptopMockup({ children }: { children: ReactNode }) {
  const scale = 0.86;
  const width = 1180;
  const screen = 690;

  return (
    <div style={{ width: width * scale, height: (screen + 36) * scale }}>
      <div style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <div
          style={{
            borderRadius: 22,
            padding: 12,
            background: "linear-gradient(180deg, #3a2430, #24161c)",
            boxShadow: "0 40px 80px -36px rgba(92,26,46,0.55)",
          }}
        >
          <div
            style={{
              height: screen,
              borderRadius: 12,
              overflow: "hidden",
              background: theme.canvas,
            }}
          >
            {children}
          </div>
        </div>
        <div
          style={{
            height: 14,
            margin: "0 auto",
            width: "108%",
            marginLeft: "-4%",
            borderRadius: "0 0 16px 16px",
            background: "linear-gradient(180deg, #4a3140, #2a1a22)",
          }}
        />
      </div>
    </div>
  );
}

export function SceneShell({
  meta,
  children,
}: {
  meta: { kicker: string; title: string; callout: string; caption: string };
  children: ReactNode;
}) {
  return (
    <AbsoluteFill>
      <BrandFonts />
      <Backdrop />
      <SceneStage kicker={meta.kicker} title={meta.title} callout={meta.callout}>
        {children}
      </SceneStage>
      <Caption text={meta.caption} />
    </AbsoluteFill>
  );
}
