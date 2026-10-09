/**
 * Anonymous browser audit for launch readiness.
 * Does not submit signup, login, booking confirmation, or billing forms.
 * Usage: node scripts/audit-browser-flows.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const outDir = "docs/evidence/launch-functional-audit";
mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: "desktop-1366", viewport: { width: 1366, height: 768 } },
  { name: "iphone-14", device: devices["iPhone 14"] },
  { name: "android-small", viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true },
];

const results = [];

function record(entry) {
  results.push(entry);
  console.log(JSON.stringify(entry));
}

async function checkPage(context, name, path, assertFn) {
  const page = await context.newPage();
  try {
    const response = await page.goto(new URL(path, base).toString(), {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    const status = response?.status() ?? 0;
    await assertFn(page, status);
    const shot = `${outDir}/${name}.png`;
    await page.screenshot({ path: shot, fullPage: true });
    record({ name, path, status, result: "PASS", evidence: shot });
  } catch (error) {
    record({ name, path, result: "FAIL", error: error.message });
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  for (const profile of viewports) {
    const context = await browser.newContext(
      profile.device
        ? { ...profile.device, locale: "pt-BR" }
        : {
            viewport: profile.viewport,
            isMobile: profile.isMobile ?? false,
            hasTouch: profile.hasTouch ?? false,
            locale: "pt-BR",
          },
    );

    await checkPage(context, `${profile.name}-landing`, "/", async (page, status) => {
      if (status !== 200) throw new Error(`status ${status}`);
      await page.getByRole("link", { name: /Agendê|Começar|Entrar|Criar/i }).first().waitFor();
      const brand = await page.locator("body").innerText();
      if (!/Agendê/i.test(brand)) throw new Error("brand missing");
    });

    await checkPage(context, `${profile.name}-cadastro`, "/cadastro", async (page, status) => {
      if (status !== 200) throw new Error(`status ${status}`);
      await page.getByRole("radio", { name: /Sou cliente/i }).waitFor();
      await page.getByRole("radio", { name: /Sou profissional/i }).waitFor();
    });

    await checkPage(context, `${profile.name}-cadastro-client`, "/cadastro?intent=client", async (page, status) => {
      if (status !== 200) throw new Error(`status ${status}`);
      const client = page.getByRole("radio", { name: /Sou cliente/i });
      if ((await client.getAttribute("aria-checked")) !== "true") {
        throw new Error("client intent not preselected");
      }
    });

    await checkPage(context, `${profile.name}-login`, "/login", async (page, status) => {
      if (status !== 200) throw new Error(`status ${status}`);
      await page.locator('input[type="email"], input[name="email"]').first().waitFor();
      await page.locator('input[type="password"], input[name="password"]').first().waitFor();
    });

    await checkPage(context, `${profile.name}-public-profile`, "/p/estudio-luna", async (page, status) => {
      if (status !== 200) throw new Error(`status ${status}`);
      await page.getByRole("heading").first().waitFor();
      const body = await page.locator("body").innerText();
      if (!/Estudio Luna/i.test(body)) throw new Error("workspace name missing");
      const hasOpenCta = await page.getByRole("link", { name: /Agendar/i }).count();
      const closed = /Agenda temporariamente fechada|Reservas pausadas/i.test(body);
      if (hasOpenCta === 0 && !closed) {
        throw new Error("expected booking CTA or closed-agenda state");
      }
    });

    await checkPage(context, `${profile.name}-public-booking`, "/p/estudio-luna/agendar", async (page, status) => {
      if (status !== 200) throw new Error(`status ${status}`);
      const body = await page.locator("body").innerText();
      // Remote demo salons may have expired trial (workspace_unavailable) or an open catalog.
      if (!/Serviço|serviço|Agenda temporariamente|horário|dispon|indispon/i.test(body)) {
        throw new Error("booking UI missing expected copy");
      }
    });

    await checkPage(context, `${profile.name}-public-profile-booking-state`, "/p/estudio-luna", async (page, status) => {
      if (status !== 200) throw new Error(`status ${status}`);
      const body = await page.locator("body").innerText();
      if (/não está público/i.test(body)) {
        throw new Error("profile should not reuse the not-found copy");
      }
      if (!/Estudio Luna|Agenda temporariamente|Escolha um horário|Reservas pausadas/i.test(body)) {
        throw new Error("profile missing booking open/closed state");
      }
    });

    await checkPage(context, `${profile.name}-app-guard`, "/app", async (page) => {
      await page.waitForURL(/\/login/);
      if (!page.url().includes("/login")) throw new Error(`expected login redirect, got ${page.url()}`);
    });

    await checkPage(context, `${profile.name}-cliente-guard`, "/cliente", async (page) => {
      await page.waitForURL(/\/login/);
      if (!page.url().includes("/login")) throw new Error(`expected login redirect, got ${page.url()}`);
    });

    await context.close();
  }
} finally {
  await browser.close();
}

const summaryPath = `${outDir}/browser-flows.json`;
writeFileSync(summaryPath, JSON.stringify({ base, generatedAt: new Date().toISOString(), results }, null, 2));
const failed = results.some((item) => item.result === "FAIL");
console.log(JSON.stringify({ summary: summaryPath, pass: results.filter((r) => r.result === "PASS").length, fail: results.filter((r) => r.result === "FAIL").length }));
process.exitCode = failed ? 1 : 0;
