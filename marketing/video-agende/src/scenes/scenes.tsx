import { AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SCENES } from "../timing";
import { theme } from "../theme";
import { Backdrop, FloralSprig, LaptopMockup, PhoneMockup, SceneShell, Wordmark } from "../components/stage";
import { BrandFonts } from "../fonts";
import { ConfirmScreen, DateScreen, ProfessionalScreen, SalonScreen, ServiceScreen, SlotScreen } from "../screens/booking-screens";
import { AgendaScreen, DashboardScreen, FinanceScreen, StockScreen, TeamScreen } from "../screens/admin-screens";

function progress() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return frame / Math.max(durationInFrames, 1);
}

export function Scene01Acesso() {
  const meta = SCENES[0]!;
  return (
    <SceneShell meta={meta}>
      <PhoneMockup>
        <SalonScreen tap />
      </PhoneMockup>
    </SceneShell>
  );
}

export function Scene02Servico() {
  const meta = SCENES[1]!;
  const t = progress();
  const showProfessional = t >= 0.48;
  const blend = interpolate(t, [0.42, 0.52], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <SceneShell meta={meta}>
      <PhoneMockup>
        <div style={{ position: "relative", height: "100%" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 1 - blend }}>
            <ServiceScreen selected={t > 0.22} />
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: blend }}>
            {showProfessional || blend > 0 ? <ProfessionalScreen /> : null}
          </div>
        </div>
      </PhoneMockup>
    </SceneShell>
  );
}

export function Scene03Horario() {
  const meta = SCENES[2]!;
  const t = progress();
  const blend = interpolate(t, [0.4, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <SceneShell meta={meta}>
      <PhoneMockup>
        <div style={{ position: "relative", height: "100%" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 1 - blend }}>
            <DateScreen />
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: blend }}>
            <SlotScreen selected={t > 0.62} />
          </div>
        </div>
      </PhoneMockup>
    </SceneShell>
  );
}

export function Scene04Reserva() {
  const meta = SCENES[3]!;
  const t = progress();
  const phase = t < 0.34 ? "summary" : t < 0.46 ? "reserving" : "done";

  return (
    <SceneShell meta={meta}>
      <PhoneMockup>
        <ConfirmScreen phase={phase} />
      </PhoneMockup>
    </SceneShell>
  );
}

export function Scene05Painel() {
  const meta = SCENES[4]!;
  const t = progress();
  return (
    <SceneShell meta={meta}>
      <LaptopMockup>
        <DashboardScreen confirmed={t > 0.48} />
      </LaptopMockup>
    </SceneShell>
  );
}

export function Scene06Agenda() {
  const meta = SCENES[5]!;
  const t = progress();
  return (
    <SceneShell meta={meta}>
      <LaptopMockup>
        <AgendaScreen week={t > 0.52} />
      </LaptopMockup>
    </SceneShell>
  );
}

export function Scene07Equipe() {
  const meta = SCENES[6]!;
  return (
    <SceneShell meta={meta}>
      <LaptopMockup>
        <TeamScreen />
      </LaptopMockup>
    </SceneShell>
  );
}

export function Scene08Estoque() {
  const meta = SCENES[7]!;
  return (
    <SceneShell meta={meta}>
      <LaptopMockup>
        <StockScreen />
      </LaptopMockup>
    </SceneShell>
  );
}

export function Scene09Financeiro() {
  const meta = SCENES[8]!;
  return (
    <SceneShell meta={meta}>
      <LaptopMockup>
        <FinanceScreen />
      </LaptopMockup>
    </SceneShell>
  );
}

export function Scene10Marca() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 80, mass: 0.85 } });
  const copy = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 90 } });
  const cta = spring({ frame: frame - 18, fps, config: { damping: 16, stiffness: 100 } });

  return (
    <AbsoluteFill>
      <BrandFonts />
      <Backdrop />
      <FloralSprig style={{ position: "absolute", left: 80, bottom: 40, width: 120, height: 190, opacity: 0.8 }} />
      <FloralSprig style={{ position: "absolute", right: 90, top: 50, width: 100, height: 160, opacity: 0.7, transform: "scaleX(-1)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: theme.fontSans }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${0.92 + enter * 0.08})`, opacity: enter }}>
          <img
            src={staticFile("brand/logo-mark.png")}
            alt=""
            style={{ width: 132, height: 132, borderRadius: 36, boxShadow: "0 24px 50px -28px rgba(92,26,46,0.65)" }}
          />
          <div style={{ marginTop: 26 }}>
            <Wordmark size={78} mark={false} />
          </div>
          <h1
            style={{
              margin: "28px 0 0",
              fontFamily: theme.fontSerif,
              fontWeight: 500,
              fontSize: 64,
              letterSpacing: "-0.03em",
              color: theme.wineDeep,
              textAlign: "center",
              lineHeight: 1,
              opacity: copy,
            }}
          >
            Comece os 7 dias grátis.
            <br />
            Sem cartão.
          </h1>
          <p style={{ margin: "16px 0 0", fontSize: 22, color: theme.muted, opacity: copy }}>
            Agenda para profissionais da beleza.
          </p>
          <div
            style={{
              marginTop: 28,
              height: 64,
              borderRadius: 999,
              background: theme.wine,
              color: "#fffaf8",
              display: "inline-flex",
              alignItems: "center",
              padding: "0 28px",
              fontSize: 22,
              fontWeight: 700,
              opacity: cta,
              transform: `translateY(${(1 - cta) * 12}px)`,
            }}
          >
            Começar 7 dias grátis
          </div>
          <p style={{ margin: "18px 0 0", fontSize: 18, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.roseInk, fontWeight: 700, opacity: cta }}>
            agendeapp.online
          </p>
        </div>
      </AbsoluteFill>
      </AbsoluteFill>
  );
}

export const SCENE_COMPONENTS = [
  Scene01Acesso,
  Scene02Servico,
  Scene03Horario,
  Scene04Reserva,
  Scene05Painel,
  Scene06Agenda,
  Scene07Equipe,
  Scene08Estoque,
  Scene09Financeiro,
  Scene10Marca,
] as const;
