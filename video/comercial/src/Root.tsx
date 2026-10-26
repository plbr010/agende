import React from "react";
import { Composition } from "remotion";
import { Commercial } from "./Commercial";
import { DURATION, FPS } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AgendeComercialVertical"
        component={Commercial}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ orientation: "vertical" }}
      />
      <Composition
        id="AgendeComercialHorizontal"
        component={Commercial}
        durationInFrames={DURATION}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ orientation: "horizontal" }}
      />
    </>
  );
};
