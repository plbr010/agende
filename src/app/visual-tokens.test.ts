import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));

test("the visual reference palette is the semantic source of the product", () => {
  assert.match(root, /--cream:\s*#fcf5f0/);
  assert.match(root, /--blush:\s*#f3c8c7/);
  assert.match(root, /--peach:\s*#e6a78f/);
  assert.match(root, /--rose:\s*#b95b76/);
  assert.match(root, /--wine:\s*#631d38/);
  assert.match(root, /--background:\s*var\(--cream\)/);
  assert.match(root, /--primary:\s*var\(--wine\)/);
  assert.match(root, /--secondary:\s*var\(--blush\)/);
  assert.match(root, /--accent:\s*var\(--peach\)/);
  assert.match(root, /--card:\s*var\(--paper\)/);
});

test("small text does not use the pale reference rose as the primary button", () => {
  assert.doesNotMatch(root, /--primary:\s*#b95b76/i);
  assert.match(root, /--rose-ink:\s*#8e3a55/);
});
