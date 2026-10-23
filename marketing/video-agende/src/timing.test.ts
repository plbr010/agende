import assert from "node:assert/strict";
import test from "node:test";
import { compositionDuration, FPS, SCENES, sceneStartFrames, TRANSITION_FRAMES } from "./timing";

test("o comercial fecha em 45 segundos", () => {
  const frames = compositionDuration();
  assert.equal(frames, 45 * FPS);
  assert.equal(frames, 1350);
});

test("há dez cenas e a última começa antes do fim", () => {
  assert.equal(SCENES.length, 10);
  const starts = sceneStartFrames();
  assert.equal(starts[0], 0);
  assert.equal(starts.length, 10);
  const last = SCENES[SCENES.length - 1];
  assert.ok(last);
  assert.equal(starts[starts.length - 1]! + last.durationInFrames, 1350);
  assert.ok(TRANSITION_FRAMES > 0);
});

test("os identificadores de cena são únicos", () => {
  const ids = SCENES.map((scene) => scene.id);
  assert.equal(new Set(ids).size, ids.length);
});
