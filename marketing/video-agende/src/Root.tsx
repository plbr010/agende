import { Composition } from "remotion";
import { AgendeCommercial } from "./AgendeCommercial";
import { SCENE_COMPONENTS } from "./scenes/scenes";
import { COMMERCIAL_ID, compositionDuration, FPS, HEIGHT, SCENES, WIDTH } from "./timing";

export function RemotionRoot() {
  return (
    <>
      <Composition
        id={COMMERCIAL_ID}
        component={AgendeCommercial}
        durationInFrames={compositionDuration()}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      {SCENES.map((scene, index) => {
        const Scene = SCENE_COMPONENTS[index];
        if (!Scene) return null;
        return (
          <Composition
            key={scene.id}
            id={scene.id}
            component={Scene}
            durationInFrames={scene.durationInFrames}
            fps={FPS}
            width={WIDTH}
            height={HEIGHT}
          />
        );
      })}
    </>
  );
}
