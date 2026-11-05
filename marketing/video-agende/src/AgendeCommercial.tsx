import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { SCENES, TRANSITION_FRAMES } from "./timing";
import { SCENE_COMPONENTS } from "./scenes/scenes";

const timing = linearTiming({ durationInFrames: TRANSITION_FRAMES });

export function AgendeCommercial() {
  return (
    <AbsoluteFill>
      <TransitionSeries>
        {SCENES.flatMap((scene, index) => {
          const Scene = SCENE_COMPONENTS[index];
          if (!Scene) return [];
          const sequence = (
            <TransitionSeries.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
              <Scene />
            </TransitionSeries.Sequence>
          );
          if (index === SCENES.length - 1) return [sequence];
          return [
            sequence,
            <TransitionSeries.Transition key={`${scene.id}-fade`} presentation={fade()} timing={timing} />,
          ];
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
