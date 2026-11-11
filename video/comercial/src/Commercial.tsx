import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, DURATION, FPS, SCENES } from "./theme";
import { fontSans, fontSerif } from "./fonts";
import { BrandWord, Caption, Pointer } from "./components/ui";
import { AppChrome, BookingChrome, Phone, StageBloom } from "./components/frames";
import { FloralBranch, FloralCorner, FloralWreath } from "./components/floral";
import {
  BookingHeader,
  Chosen,
  ConfirmCard,
  DateGrid,
  ProfessionalList,
  ServiceList,
  SlotGrid,
  StepBar,
  SuccessCard,
} from "./components/booking";
import {
  AgendaScreen,
  ClientsScreen,
  FinanceScreen,
  HomeScreen,
  ServicesScreen,
  TeamScreen,
} from "./components/dashboard";
import { SALON } from "./demo-data";

export type Orientation = "vertical" | "horizontal";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

function fade(frame: number, start: number, dur = 14) {
  return interpolate(frame, [start, start + dur], [0, 1], clamp);
}

function tapAt(frame: number, at: number) {
  return interpolate(frame, [at, at + 5, at + 14], [0, 1, 0], clamp);
}

function BookingBody({
  frame,
  step,
}: {
  frame: number;
  step: "chat" | "service" | "pro" | "date" | "slot" | "confirm" | "success";
}) {
  if (step === "chat") {
    const bubble = spring({ frame, fps: FPS, config: { damping: 16 } });
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#f3ebe6",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            height: 62,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: C.wineDeep,
            color: C.white,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: C.blush,
              color: C.wineDeep,
              display: "grid",
              placeItems: "center",
              fontFamily: fontSerif,
              fontSize: 14,
            }}
          >
            SP
          </div>
          <div>
            <p style={{ margin: 0, fontFamily: fontSans, fontWeight: 600, fontSize: 15 }}>{SALON.name}</p>
            <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 11, opacity: 0.75 }}>online</p>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <p style={{ margin: "4px 0 14px", textAlign: "center", fontFamily: fontSans, fontSize: 12, color: C.muted }}>
            Hoje · 9:41
          </p>
          <div
            style={{
              maxWidth: "90%",
              borderRadius: "18px 18px 18px 6px",
              background: C.paper,
              padding: "14px 16px",
              boxShadow: "0 10px 24px -16px rgb(92 26 46 / 0.45)",
              transform: `translateY(${(1 - bubble) * 16}px)`,
              opacity: bubble,
            }}
          >
            <p style={{ margin: 0, fontFamily: fontSans, fontSize: 15, color: C.ink, lineHeight: 1.45 }}>
              Oi, Bia! Segue o link pra agendar seus cílios ✨
            </p>
            <div
              style={{
                marginTop: 10,
                borderRadius: 14,
                background: C.metricBlush,
                padding: "10px 12px",
                border: `1px solid ${C.ring}`,
              }}
            >
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.roseInk }}>
                Agendar horário
              </p>
              <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: C.wineDeep }}>
                {SALON.publicUrl}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BookingChrome>
      <div style={{ display: "grid", gap: 12 }}>
        <BookingHeader />
        {step !== "success" ? (
          <StepBar
            current={
              step === "service" ? 0 : step === "pro" ? 1 : step === "date" ? 2 : step === "slot" ? 3 : 5
            }
          />
        ) : null}
        <Chosen
          service={step !== "service"}
          pro={step === "date" || step === "slot" || step === "confirm"}
          date={step === "slot" || step === "confirm"}
        />
        {step === "service" ? <ServiceList selected={frame > 168} /> : null}
        {step === "pro" ? <ProfessionalList selected={frame > 40} /> : null}
        {step === "date" ? <DateGrid selected={frame > 38} /> : null}
        {step === "slot" ? <SlotGrid selected={frame > 32} /> : null}
        {step === "confirm" ? <ConfirmCard /> : null}
        {step === "success" ? <SuccessCard /> : null}
      </div>
    </BookingChrome>
  );
}

function useLayout() {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  return { vertical, showCaption: vertical };
}

function Device({ url, children }: { url?: string; children: React.ReactNode }) {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const baseW = 400;
  const baseH = 770;
  const scale = vertical
    ? Math.min((width - 48) / baseW, (height - 168) / baseH)
    : Math.min(430 / baseW, 720 / baseH);
  return (
    <div style={{ width: baseW * scale, height: baseH * scale, position: "relative", flexShrink: 0 }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <Phone width={baseW} height={baseH} url={url}>
          {children}
        </Phone>
      </div>
    </div>
  );
}

function SceneBookingIntro({ frame }: { frame: number }) {
  const enter = spring({ frame, fps: FPS, config: { damping: 15, mass: 0.8 } });
  const step = frame < 70 ? "chat" : "service";
  const pointerOpacity = interpolate(frame, [150, 165, 210, 230], [0, 1, 1, 0], clamp);
  const pressed = tapAt(frame, 168);
  return (
    <div style={{ transform: `translateY(${(1 - enter) * 80}px)`, opacity: enter }}>
      <Device url={frame >= 70 ? SALON.publicUrl : undefined}>
        <BookingBody frame={frame} step={step} />
        <Pointer x={200} y={300} pressed={pressed} opacity={pointerOpacity} />
      </Device>
    </div>
  );
}

function SceneBookingFlow({ frame }: { frame: number }) {
  const step =
    frame < 70 ? "pro" : frame < 145 ? "date" : frame < 220 ? "slot" : frame < 290 ? "confirm" : "success";
  const local =
    frame < 70
      ? frame
      : frame < 145
        ? frame - 70
        : frame < 220
          ? frame - 145
          : frame < 290
            ? frame - 220
            : frame - 290;
  const pointer =
    step === "pro"
      ? { x: 210, y: 292, show: interpolate(frame, [18, 30, 52, 68], [0, 1, 1, 0], clamp), press: tapAt(frame, 40) }
      : step === "date"
        ? { x: 248, y: 430, show: interpolate(frame, [80, 92, 128, 142], [0, 1, 1, 0], clamp), press: tapAt(frame, 108) }
        : step === "slot"
          ? { x: 210, y: 318, show: interpolate(frame, [155, 168, 205, 218], [0, 1, 1, 0], clamp), press: tapAt(frame, 177) }
          : step === "confirm"
            ? { x: 215, y: 560, show: interpolate(frame, [230, 242, 278, 288], [0, 1, 1, 0], clamp), press: tapAt(frame, 258) }
            : { x: 0, y: 0, show: 0, press: 0 };

  const caption = interpolate(frame, [292, 312], [0, 1], clamp);
  const { showCaption } = useLayout();

  return (
    <>
      <Device url={SALON.publicUrl}>
        <BookingBody frame={local} step={step} />
        <Pointer x={pointer.x} y={pointer.y} pressed={pointer.press} opacity={pointer.show} />
      </Device>
      {showCaption ? (
        <div style={{ position: "absolute", left: 36, right: 36, bottom: 28, zIndex: 5 }}>
          <Caption text="Sua cliente agenda em poucos cliques." opacity={caption} />
        </div>
      ) : null}
    </>
  );
}

function SceneAgenda({ frame }: { frame: number }) {
  const showHome = frame < 70;
  const showNew = frame > 130;
  const caption = interpolate(frame, [150, 175], [0, 1], clamp);
  const { showCaption } = useLayout();
  const slide = spring({
    frame: Math.max(0, frame - 70),
    fps: FPS,
    config: { damping: 16 },
  });
  return (
    <>
      <Device>
        <AppChrome active={showHome ? "inicio" : "agenda"}>
          <div
            style={{
              opacity: showHome ? interpolate(frame, [55, 70], [1, 0], clamp) : slide,
              transform: showHome ? "none" : `translateY(${(1 - slide) * 24}px)`,
            }}
          >
            {showHome ? <HomeScreen /> : <AgendaScreen showNew={showNew} />}
          </div>
        </AppChrome>
      </Device>
      {showCaption ? (
        <div style={{ position: "absolute", left: 36, right: 36, bottom: 28, zIndex: 5 }}>
          <Caption text="Tudo organizado em um só lugar." opacity={caption} />
        </div>
      ) : null}
    </>
  );
}

function SceneManage({ frame }: { frame: number }) {
  const page = frame < 120 ? "clientes" : frame < 250 ? "servicos" : "equipe";
  const local = page === "clientes" ? frame : page === "servicos" ? frame - 120 : frame - 250;
  const enter = spring({ frame: local, fps: FPS, config: { damping: 18 } });
  const caption = interpolate(frame, [20, 40], [0, 1], clamp);
  const { showCaption } = useLayout();
  return (
    <>
      <Device>
        <AppChrome active={page === "clientes" ? "clientes" : "mais"}>
          <div style={{ opacity: enter, transform: `translateX(${(1 - enter) * 28}px)` }}>
            {page === "clientes" ? <ClientsScreen /> : page === "servicos" ? <ServicesScreen /> : <TeamScreen />}
          </div>
        </AppChrome>
      </Device>
      {showCaption ? (
        <div style={{ position: "absolute", left: 36, right: 36, bottom: 28, zIndex: 5 }}>
          <Caption text="Clientes, serviços e equipe — simples de usar." opacity={caption} compact />
        </div>
      ) : null}
    </>
  );
}

function SceneFinance({ frame }: { frame: number }) {
  const enter = spring({ frame, fps: FPS, config: { damping: 16 } });
  const caption = interpolate(frame, [40, 62], [0, 1], clamp);
  const { showCaption } = useLayout();
  return (
    <>
      <Device>
        <AppChrome active="mais">
          <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 20}px)` }}>
            <FinanceScreen />
          </div>
        </AppChrome>
      </Device>
      {showCaption ? (
        <div style={{ position: "absolute", left: 36, right: 36, bottom: 28, zIndex: 5 }}>
          <Caption text="O dinheiro do salão, visível de verdade." opacity={caption} compact />
        </div>
      ) : null}
    </>
  );
}

function SceneClose({ frame }: { frame: number }) {
  const logo = spring({ frame, fps: FPS, config: { damping: 14 } });
  const line = interpolate(frame, [28, 50], [0, 1], clamp);
  const cta = interpolate(frame, [70, 95], [0, 1], clamp);
  const url = interpolate(frame, [100, 125], [0, 1], clamp);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        padding: 48,
      }}
    >
      <FloralWreath
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          opacity: 0.55 * logo,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -62%)",
        }}
      />
      <div style={{ transform: `scale(${0.86 + logo * 0.14})`, opacity: logo, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <BrandWord size={72} />
        </div>
      </div>
      <p
        style={{
          margin: "40px 0 0",
          maxWidth: 780,
          textAlign: "center",
          fontFamily: fontSerif,
          fontSize: 44,
          lineHeight: 1.22,
          color: C.wineDeep,
          opacity: line,
        }}
      >
        Mais organização. Mais praticidade.
        <br />
        Mais tempo para você.
      </p>
      <div
        style={{
          marginTop: 36,
          opacity: cta,
          background: C.rose,
          color: C.white,
          borderRadius: 999,
          padding: "16px 28px",
          fontFamily: fontSans,
          fontSize: 22,
          fontWeight: 600,
          boxShadow: "0 16px 36px -18px rgb(196 93 124 / 0.8)",
        }}
      >
        Conheça o Agendê
      </div>
      <p
        style={{
          margin: "16px 0 0",
          fontFamily: fontSans,
          fontSize: 24,
          fontWeight: 600,
          color: C.roseInk,
          opacity: url,
        }}
      >
        agendeapp.online
      </p>
    </div>
  );
}

function VerticalStage({ children }: { children: React.ReactNode }) {
  const sceneOpacity = 1;
  return (
    <AbsoluteFill style={{ background: C.cream, fontFamily: fontSans }}>
      <StageBloom />
      <FloralCorner
        style={{
          position: "absolute",
          left: -20,
          bottom: 220,
          width: 220,
          height: 170,
          opacity: 0.7,
        }}
      />
      <FloralBranch
        style={{
          position: "absolute",
          right: -30,
          bottom: 40,
          width: 180,
          height: 230,
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: sceneOpacity,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}

function HorizontalStage({ children, caption }: { children: React.ReactNode; caption?: React.ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        background: C.cream,
        fontFamily: fontSans,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        padding: "48px 64px",
        gap: 48,
      }}
    >
      <StageBloom />
      <div style={{ flex: "0 0 460px", display: "flex", justifyContent: "center", zIndex: 1 }}>{children}</div>
      <div style={{ flex: 1, zIndex: 1, maxWidth: 820 }}>{caption}</div>
    </AbsoluteFill>
  );
}

export const Commercial: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const vertical = orientation === "vertical" || width < 1200;

  const inScene = (key: keyof typeof SCENES) => {
    const { from, dur } = SCENES[key];
    return frame >= from && frame < from + dur;
  };
  const local = (key: keyof typeof SCENES) => frame - SCENES[key].from;

  if (inScene("close")) {
    const localFrame = local("close");
    return (
      <AbsoluteFill style={{ background: C.cream }}>
        <StageBloom />
        <SceneClose frame={localFrame} />
      </AbsoluteFill>
    );
  }

  if (!vertical) {
    const captionText = inScene("bookingFlow")
      ? "Sua cliente agenda em poucos cliques."
      : inScene("agenda")
        ? "Tudo organizado em um só lugar."
        : inScene("manage")
          ? "Clientes, serviços e equipe — simples de usar."
          : inScene("finance")
            ? "O dinheiro do salão, visível de verdade."
            : "A cliente marca. Você atende.";
    const captionOpacity = fade(frame % 200, 8, 16);
    return (
      <HorizontalStage
        caption={
          <div>
            <BrandWord size={42} />
            <div style={{ marginTop: 28 }}>
              <Caption text={captionText} opacity={Math.max(captionOpacity, 0.85)} />
            </div>
            <p
              style={{
                marginTop: 28,
                fontFamily: fontSans,
                fontSize: 18,
                color: C.muted,
                lineHeight: 1.5,
                maxWidth: 520,
              }}
            >
              Agenda, clientes, serviços, equipe e financeiro — o produto real, com dados ilustrativos.
            </p>
          </div>
        }
      >
        {inScene("bookingIntro") ? (
          <SceneBookingIntro frame={local("bookingIntro")} />
        ) : inScene("bookingFlow") ? (
          <SceneBookingFlow frame={local("bookingFlow")} />
        ) : inScene("agenda") ? (
          <SceneAgenda frame={local("agenda")} />
        ) : inScene("manage") ? (
          <SceneManage frame={local("manage")} />
        ) : (
          <SceneFinance frame={local("finance")} />
        )}
      </HorizontalStage>
    );
  }

  return (
    <VerticalStage>
      {inScene("bookingIntro") ? <SceneBookingIntro frame={local("bookingIntro")} /> : null}
      {inScene("bookingFlow") ? <SceneBookingFlow frame={local("bookingFlow")} /> : null}
      {inScene("agenda") ? <SceneAgenda frame={local("agenda")} /> : null}
      {inScene("manage") ? <SceneManage frame={local("manage")} /> : null}
      {inScene("finance") ? <SceneFinance frame={local("finance")} /> : null}
    </VerticalStage>
  );
};

export const commercialSchema = {
  durationInFrames: DURATION,
  fps: FPS,
};
