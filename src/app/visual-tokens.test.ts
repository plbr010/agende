import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));

test("the visual reference palette is the semantic source of the product", () => {
  assert.match(root, /--cream:\s*#fbf4ee/);
  assert.match(root, /--blush:\s*#f3c4c2/);
  assert.match(root, /--peach:\s*#e8b4a0/);
  assert.match(root, /--rose:\s*#c45d7c/);
  assert.match(root, /--wine:\s*#6b2d42/);
  assert.match(root, /--wine-deep:\s*#5c1a2e/);
  assert.match(root, /--sidebar-active:\s*#8d3b51/);
  assert.match(root, /--metric-blush:\s*#fdecea/);
  assert.match(root, /--metric-sand:\s*#f8ebdd/);
  assert.match(root, /--metric-ivory:\s*#f7f1dc/);
  assert.match(root, /--metric-lilac:\s*#f4eef3/);
  assert.match(root, /--background:\s*var\(--cream\)/);
  assert.match(root, /--primary:\s*var\(--wine\)/);
  assert.match(root, /--sidebar:\s*var\(--wine-deep\)/);
  assert.match(root, /--secondary:\s*var\(--blush\)/);
  assert.match(root, /--accent:\s*var\(--peach\)/);
  assert.match(root, /--card:\s*var\(--paper\)/);
});

test("shared panel class keeps cream cards consistent across launch screens", () => {
  assert.match(css, /\.agende-panel/);
  assert.match(css, /\.agende-app/);
});

test("small text does not use the pale reference rose as the primary button", () => {
  assert.doesNotMatch(root, /--primary:\s*#c45d7c/i);
  assert.match(root, /--primary:\s*var\(--wine\)/);
  assert.match(root, /--rose-ink:\s*#9a3d58/);
});
