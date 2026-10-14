import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function source(relative: string) {
  return readFileSync(join(root, relative), "utf8");
}

test("approved mark, favicon and PWA icons exist without a padded white canvas", () => {
  const files = [
    "src/app/favicon.ico",
    "src/app/icon.png",
    "src/app/apple-icon.png",
    "public/brand/logo-mark.png",
    "public/icons/icon-16.png",
    "public/icons/icon-32.png",
    "public/icons/icon-48.png",
    "public/icons/icon-180.png",
    "public/icons/icon-192.png",
    "public/icons/icon-512.png",
    "src/app/fonts/PlayfairDisplay.ttf",
    "src/app/fonts/Inter.ttf",
  ];
  for (const file of files) {
    assert.equal(existsSync(join(root, file)), true, file);
  }
  assert.ok(readFileSync(join(root, "src/app/favicon.ico")).byteLength > 2000);
  assert.ok(readFileSync(join(root, "public/brand/logo-mark.png")).byteLength < 200_000);
});

test("wordmark uses the cropped mark and Playfair stays the heading face", () => {
  const logo = source("src/components/brand/logo.tsx");
  assert.match(logo, /\/brand\/logo-mark\.png/);
  assert.match(logo, /font-serif/);
  assert.match(logo, /compact/);
  const layout = source("src/app/layout.tsx");
  assert.match(layout, /PlayfairDisplay/);
  assert.match(layout, /Inter\.ttf/);
  assert.match(layout, /icon-16\.png/);
  assert.match(layout, /apple-icon/);
});

test("homepage splits client and professional and never lists SaaS prices", () => {
  const home = source("src/app/page.tsx");
  assert.match(home, /AudienceSplit/);
  assert.match(home, /MarketingHero/);
  assert.doesNotMatch(home, /MarketingPricing/);
  assert.doesNotMatch(home, /R\$ 89/);
  assert.doesNotMatch(home, /R\$ 169/);
  const nav = source("src/lib/marketing/content.ts");
  assert.match(nav, /Para profissionais/);
  assert.match(nav, /Sou cliente/);
  assert.doesNotMatch(nav, /href: "\/#planos"/);
  const profissionais = source("src/app/profissionais/page.tsx");
  assert.match(profissionais, /MarketingPricing/);
  assert.match(profissionais, /7 dias grátis/);
});

test("client chrome does not advertise Solo, Equipe or checkout SaaS", () => {
  const shell = source("src/components/client/client-shell.tsx");
  assert.doesNotMatch(shell, /R\$ 89/);
  assert.doesNotMatch(shell, /assinatura/);
  assert.doesNotMatch(shell, /\/app\/configuracoes\/assinatura/);
  assert.match(shell, /\/cliente\/descobrir/);
});
