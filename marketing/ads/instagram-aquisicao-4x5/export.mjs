/**
 * Captures real Agendê screens from local /identidade previews and composes
 * the Instagram 4:5 acquisition ad. Does not change SaaS behavior.
 *
 * Usage:
 *   node marketing/ads/instagram-aquisicao-4x5/export.mjs
 *   node marketing/ads/instagram-aquisicao-4x5/export.mjs --compose-only
 *   node marketing/ads/instagram-aquisicao-4x5/export.mjs --capture-only
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const dir = join(root, "marketing/ads/instagram-aquisicao-4x5");
const capturesDir = join(dir, "captures");
const outputDir = join(dir, "output");
const copy = JSON.parse(readFileSync(join(dir, "copy.json"), "utf8"));
const args = new Set(process.argv.slice(2));
const composeOnly = args.has("--compose-only");
const captureOnly = args.has("--capture-only");
const port = Number(process.env.AGENDE_AD_PORT ?? 3017);
const origin = `http://127.0.0.1:${port}`;

mkdirSync(capturesDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });

const PATHS = {
  dashboard: join(capturesDir, "painel-profissional.png"),
  agenda: join(capturesDir, "agenda.png"),
  servicos: join(capturesDir, "servicos.png"),
  servicoCard: join(capturesDir, "servico-card.png"),
  mobile: join(capturesDir, "painel-mobile.png"),
  composedHtml: join(dir, "ad.html"),
  png: join(outputDir, "agende-instagram-4x5.png"),
  png2x: join(outputDir, "agende-instagram-4x5@2x.png"),
};

function loadPlaywright() {
  try {
    return require(join(root, "node_modules/playwright"));
  } catch {
    return require("playwright");
  }
}

async function waitForServer(url, timeoutMs = 120_000) {
  const start = Date.now();
  let lastError = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortTimeout(4000) });
      if (response.status > 0) return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Servidor local não respondeu em ${url}. ${lastError}`);
}

function AbortTimeout(ms) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function ensureServer() {
  try {
    const response = await fetch(`${origin}/identidade`, { redirect: "manual", signal: AbortTimeout(2500) });
    if (response.ok || response.status === 200) return null;
  } catch {
    // start a dedicated server
  }
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: root,
      stdio: "ignore",
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ci_placeholder",
        NEXT_PUBLIC_SITE_URL: origin,
        SITE_URL: origin,
        NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV: "development",
      },
    },
  );
  await waitForServer(`${origin}/identidade`);
  return child;
}

const HIDE_PREVIEW = `
  p.bg-wine-deep { display: none !important; }
  section[aria-label="Prévia do agendamento no celular"] { display: none !important; }
  section[aria-label="Ocultos na agenda online"] { display: none !important; }
  nextjs-portal { display: none !important; }
  .grid.gap-10 { gap: 0 !important; padding-bottom: 0 !important; }
`;

async function readyPage(page) {
  await page.addStyleTag({ content: HIDE_PREVIEW });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

async function clipLocator(page, locator, file, maxWidth, maxHeight) {
  await locator.waitFor({ state: "visible" });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Não foi possível medir ${file}`);
  const width = Math.min(Math.floor(box.width), maxWidth);
  const height = Math.min(Math.floor(box.height), maxHeight);
  await page.screenshot({
    path: file,
    animations: "disabled",
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width,
      height,
    },
  });
}

async function captureScreens(browser) {
  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: "pt-BR",
  });
  desktop.setDefaultTimeout(90_000);

  await desktop.goto(`${origin}/identidade`, { waitUntil: "networkidle" });
  await readyPage(desktop);
  const dashboard = desktop.locator(".agende-app");
  await clipLocator(desktop, dashboard, PATHS.dashboard, 1440, 860);
  const agenda = desktop.locator("article").filter({ hasText: "Agenda de hoje" }).first();
  await agenda.screenshot({ path: PATHS.agenda, animations: "disabled" });

  await desktop.goto(`${origin}/identidade/servicos`, { waitUntil: "networkidle" });
  await readyPage(desktop);
  await clipLocator(desktop, desktop.locator(".agende-app"), PATHS.servicos, 1440, 860);
  const serviceCard = desktop.locator("article").filter({ hasText: "Manicure" }).first();
  await serviceCard.screenshot({ path: PATHS.servicoCard, animations: "disabled" });
  await desktop.close();

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    locale: "pt-BR",
    isMobile: true,
    hasTouch: true,
  });
  mobile.setDefaultTimeout(90_000);
  await mobile.goto(`${origin}/identidade`, { waitUntil: "networkidle" });
  await readyPage(mobile);
  await clipLocator(mobile, mobile.locator(".agende-app"), PATHS.mobile, 390, 760);
  await mobile.close();
}

function relativeFromAd(absolutePath) {
  return absolutePath.replace(`${dir}/`, "");
}

function composeHtml() {
  const template = readFileSync(join(dir, "ad.template.html"), "utf8");
  const headlineHtml = copy.headlineLines.map((line) => `${escapeHtml(line)}<br>`).join("").replace(/<br>$/, "");
  return template
    .replaceAll("{{FONT_PLAYFAIR}}", "../../../src/app/fonts/PlayfairDisplay.ttf")
    .replaceAll("{{FONT_PLAYFAIR_ITALIC}}", "../../../src/app/fonts/PlayfairDisplay-Italic.ttf")
    .replaceAll("{{FONT_INTER}}", "../../../src/app/fonts/Inter.ttf")
    .replaceAll("{{LOGO_MARK}}", "../../../public/brand/logo-mark.png")
    .replaceAll("{{DASHBOARD}}", relativeFromAd(PATHS.dashboard))
    .replaceAll("{{MOBILE}}", relativeFromAd(PATHS.mobile))
    .replaceAll("{{SERVICES}}", relativeFromAd(PATHS.servicoCard))
    .replaceAll("{{HEADLINE_HTML}}", headlineHtml)
    .replaceAll("{{SUPPORT}}", (copy.supportLines ?? [copy.support]).map(escapeHtml).join("<br>"))
    .replaceAll("{{BADGE}}", escapeHtml(copy.badge))
    .replaceAll("{{CLOSING}}", escapeHtml(copy.closing))
    .replaceAll("{{CTA}}", escapeHtml(copy.cta))
    .replaceAll("{{DOMAIN}}", escapeHtml(copy.domain));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function renderAd(browser) {
  const html = composeHtml();
  writeFileSync(PATHS.composedHtml, html);
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1350 },
    deviceScaleFactor: 2,
  });
  page.setDefaultTimeout(60_000);
  await page.goto(pathToFileURL(PATHS.composedHtml).href, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => {
      if (image.complete && image.naturalWidth > 0) return null;
      return new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", () => reject(new Error(`Falha ao carregar ${image.src}`)), { once: true });
      });
    }));
  });
  await page.waitForTimeout(200);
  const shot2x = await page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: 1080, height: 1350 },
    animations: "disabled",
  });
  writeFileSync(PATHS.png2x, shot2x);
  const sharp = (await import("sharp")).default;
  await sharp(shot2x)
    .resize(1080, 1350, { kernel: "lanczos3" })
    .png({ compressionLevel: 9, palette: false })
    .toFile(PATHS.png);
  await page.close();
}

function stop(child) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
}

const { chromium } = loadPlaywright();
let server = null;
const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
try {
  if (!composeOnly) {
    server = await ensureServer();
    await waitForServer(`${origin}/identidade`);
    await captureScreens(browser);
  } else {
    for (const file of [PATHS.dashboard, PATHS.mobile, PATHS.servicoCard]) {
      if (!existsSync(file)) throw new Error(`Falta captura ${file}. Rode sem --compose-only.`);
    }
  }
  if (!captureOnly) await renderAd(browser);
  console.log(JSON.stringify({
    ok: true,
    png: PATHS.png,
    png2x: PATHS.png2x,
    html: PATHS.composedHtml,
    captures: PATHS,
  }, null, 2));
} finally {
  await browser.close();
  stop(server);
}
