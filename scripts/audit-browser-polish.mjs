/**
 * Anonymous browser polish audit for launch.
 * Does not submit signup/login/booking forms.
 * Usage: node scripts/audit-browser-polish.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const outDir = "docs/evidence/launch-final-polish";
mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: "desktop-1366", viewport: { width: 1366, height: 768 } },
  { name: "iphone-13", device: devices["iPhone 13"] },
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
      const text = await page.locator("body").innerText();
      if (!/Agendê/i.test(text)) throw new Error("brand missing");
    });

    await checkPage(context, `${profile.name}-cadastro-plan`, "/cadastro?plan=equipe", async (page, status) => {
      if (status !== 200) throw new Error(`status ${status}`);
      const pro = page.getByRole("radio", { name: /Sou profissional/i });
      if ((await pro.getAttribute("aria-checked")) !== "true") {
        throw new Error("professional intent not preselected for plan");
      }
      await page.getByRole("radio", { name: /Sou cliente/i }).click();
      const body = await page.locator("body").innerText();
      if (!/plano selecionado vale só para a conta profissional/i.test(body)) {
        throw new Error("missing plan/intent clarification");
      }
    });

    await checkPage(context, `${profile.name}-verificar-email`, "/verificar-email", async (page, status) => {
      if (status !== 200) throw new Error(`status ${status}`);
      const body = await page.locator("body").innerText();
      if (!/1\. Conta|Confirmação|Já confirmei/i.test(body)) {
        throw new Error("verify-email polish missing");
      }
    });

    await checkPage(context, `${profile.name}-public-profile`, "/p/estudio-luna", async (page, status) => {
      if (status !== 200) throw new Error(`status ${status}`);
      const body = await page.locator("body").innerText();
      if (!/Estudio Luna|Agenda temporariamente|Escolha um horário/i.test(body)) {
        throw new Error("public profile unexpected");
      }
    });

    await checkPage(context, `${profile.name}-public-booking`, "/p/estudio-luna/agendar", async (page, status) => {
      if (status !== 200) throw new Error(`status ${status}`);
      const body = await page.locator("body").innerText();
      if (/não está público/i.test(body) && !/temporariamente/i.test(body)) {
        throw new Error("misleading not-found for expired trial");
      }
    });

    await checkPage(context, `${profile.name}-app-guard`, "/app", async (page) => {
      await page.waitForURL(/\/login/);
    });

    await checkPage(context, `${profile.name}-onboarding-guard`, "/onboarding", async (page) => {
      await page.waitForURL(/\/login|\/verificar-email|\/app|\/cliente/);
    });

    await context.close();
  }
} finally {
  await browser.close();
}

const summaryPath = `${outDir}/browser-polish.json`;
writeFileSync(summaryPath, JSON.stringify({ base, generatedAt: new Date().toISOString(), results }, null, 2));
const failed = results.some((item) => item.result === "FAIL");
console.log(
  JSON.stringify({
    summary: summaryPath,
    pass: results.filter((r) => r.result === "PASS").length,
    fail: results.filter((r) => r.result === "FAIL").length,
  }),
);
process.exitCode = failed ? 1 : 0;
