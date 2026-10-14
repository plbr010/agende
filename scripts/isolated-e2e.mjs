/**
 * Isolated public-journey browser tests.
 * Starts the already-built app with synthetic env. Never hits production.
 * Does not submit signup, login, booking or billing.
 *
 * Usage: npm run test:e2e
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const port = 3109;
const base = `http://127.0.0.1:${port}`;
const outDir = process.env.AGENDE_E2E_OUTPUT ?? (process.platform === "win32" ? "docs/evidence/isolated-public-e2e" : "/opt/cursor/artifacts/e2e");
mkdirSync(outDir, { recursive: true });

const results = [];
function record(entry) {
  results.push(entry);
  console.log(JSON.stringify(entry));
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    return null;
  }
}

async function launchBrowser(chromium) {
  try {
    return await chromium.launch({ channel: process.env.AGENDE_BROWSER_CHANNEL ?? "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_placeholder",
    NEXT_PUBLIC_SITE_URL: base,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Local server did not become ready")), 30_000);
    let output = "";
    function onData(chunk) {
      output += chunk.toString();
      if (output.includes("Ready in")) {
        clearTimeout(timeout);
        resolve();
      }
    }
    server.stdout.on("data", onData);
    server.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      onData(chunk);
    });
    server.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Local server exited with ${code}`));
    });
  });

  const playwright = loadPlaywright();
  if (!playwright) {
    record({ name: "playwright", result: "BLOQUEADO", error: "pacote playwright ausente neste ambiente" });
  } else {
    let browser;
    try {
      browser = await launchBrowser(playwright.chromium);
    } catch (error) {
      record({ name: "browser", result: "BLOQUEADO", error: error.message });
    }

    if (browser) {
      const context = await browser.newContext({
        locale: "pt-BR",
        viewport: { width: 1280, height: 800 },
        geolocation: { latitude: -21.764, longitude: -43.35 },
        permissions: ["geolocation"],
      });
      await context.route("https://api.bigdatacloud.net/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            city: "Juiz de Fora",
            principalSubdivisionCode: "BR-MG",
            countryCode: "BR",
          }),
        });
      });

      async function shot(page, name) {
        const path = `${outDir}/${name}.png`;
        await page.screenshot({ path, fullPage: false });
        return path;
      }

      const page = await context.newPage();

      try {
        await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.getByRole("link", { name: /Começar 7 dias grátis/i }).first().waitFor();
        record({ name: "landing", result: "PASS", evidence: await shot(page, "landing") });
      } catch (error) {
        record({ name: "landing", result: "FAIL", error: error.message });
      }

      try {
        await page.goto(`${base}/cadastro`, { waitUntil: "domcontentloaded", timeout: 20000 });
        const client = page.getByRole("radio", { name: /Quero marcar horários/i });
        const professional = page.getByRole("radio", { name: /Tenho salão ou atendo/i });
        await client.waitFor();
        await professional.focus();
        await professional.press("ArrowUp");
        if ((await client.getAttribute("aria-checked")) !== "true") {
          throw new Error("arrow key did not select client intent");
        }
        record({ name: "cadastro-keyboard", result: "PASS", evidence: await shot(page, "cadastro") });
      } catch (error) {
        record({ name: "cadastro-keyboard", result: "FAIL", error: error.message });
      }

      try {
        await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.getByLabel(/e-mail/i).waitFor();
        await page.getByLabel(/^senha$/i).waitFor();
        await page.getByRole("button", { name: /^entrar$/i }).waitFor();
        record({ name: "login", result: "PASS", evidence: await shot(page, "login") });
      } catch (error) {
        record({ name: "login", result: "FAIL", error: error.message });
      }

      try {
        await page.goto(`${base}/descobrir`, { waitUntil: "domcontentloaded", timeout: 20000 });
        const body = await page.locator("body").innerText();
        if (!/Muriaé/.test(body) || !/Juiz de Fora/.test(body)) {
          throw new Error("Muriaé/Juiz de Fora scenario copy missing");
        }
        await page.getByRole("radio", { name: "Uma cidade" }).waitFor();
        await page.getByRole("button", { name: "Procurar estabelecimentos" }).click();
        await page.getByRole("alert").filter({ hasText: /cidade/i }).waitFor({ timeout: 5000 });
        record({ name: "discovery-empty-city", result: "PASS", evidence: await shot(page, "discovery-empty-city") });
      } catch (error) {
        record({ name: "discovery-empty-city", result: "FAIL", error: error.message });
      }

      try {
        await page.getByRole("radio", { name: "Perto de mim" }).click();
        await page.getByRole("button", { name: "Usar minha localização" }).click();
        await page.getByRole("status").filter({ hasText: /Juiz de Fora/i }).waitFor({ timeout: 8000 });
        await page.getByRole("button", { name: "Procurar estabelecimentos" }).click();
        await page.getByText(/ainda não está no ar|Não foi possível concluir a busca|Nenhum salão nesta busca/i).waitFor({ timeout: 8000 });
        const nearbyBody = await page.locator("body").innerText();
        if (/Studio Aurora|Salão Exemplo|Ateliê Luz/.test(nearbyBody)) {
          throw new Error("invented salon appeared after nearby search");
        }
        record({ name: "discovery-gps-jf", result: "PASS", evidence: await shot(page, "discovery-gps-jf") });
      } catch (error) {
        record({ name: "discovery-gps-jf", result: "FAIL", error: error.message });
      }

      try {
        await page.getByRole("radio", { name: "Uma cidade" }).click();
        await page.getByLabel("Cidade").fill("Muriaé");
        await page.getByLabel("Estado").selectOption("MG");
        await page.getByRole("button", { name: "Procurar estabelecimentos" }).click();
        await page.getByText(/ainda não está no ar|Não foi possível concluir a busca|Nenhum salão nesta busca/i).waitFor({ timeout: 8000 });
        const cityBody = await page.locator("body").innerText();
        if (/Studio Aurora|Salão Exemplo/.test(cityBody)) {
          throw new Error("invented salon appeared after Muriaé search");
        }
        record({ name: "discovery-city-muriae", result: "PASS", evidence: await shot(page, "discovery-city-muriae") });
      } catch (error) {
        record({ name: "discovery-city-muriae", result: "FAIL", error: error.message });
      }

      try {
        await page.getByRole("radio", { name: "Nome do salão" }).click();
        await page.getByLabel("Nome do salão ou profissional").fill("Aurora");
        await page.getByRole("button", { name: "Procurar estabelecimentos" }).click();
        await page.getByText(/ainda não está no ar|Não foi possível concluir a busca|Nenhum salão nesta busca/i).waitFor({ timeout: 8000 });
        const globalBody = await page.locator("body").innerText();
        if (/Studio Aurora|Salão Exemplo/.test(globalBody)) {
          throw new Error("invented salon appeared after name search");
        }
        record({ name: "discovery-global-name", result: "PASS", evidence: await shot(page, "discovery-global-name") });
      } catch (error) {
        record({ name: "discovery-global-name", result: "FAIL", error: error.message });
      }

      try {
        await page.goto(`${base}/p/e2e-audit-nonexistent-pr12`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.getByRole("heading", { name: /Não encontramos este salão/i }).waitFor({ timeout: 15000 });
        record({ name: "public-not-found", result: "PASS", evidence: await shot(page, "public-not-found") });
      } catch (error) {
        record({ name: "public-not-found", result: "FAIL", error: error.message });
      }

      try {
        await page.goto(`${base}/app`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForURL(/\/login/, { timeout: 10000 });
        record({ name: "app-guard", result: "PASS", evidence: await shot(page, "app-guard") });
      } catch (error) {
        record({ name: "app-guard", result: "FAIL", error: error.message });
      }

      try {
        const deniedCtx = await browser.newContext({
          locale: "pt-BR",
          viewport: { width: 1280, height: 800 },
        });
        const deniedPage = await deniedCtx.newPage();
        await deniedPage.goto(`${base}/descobrir`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await deniedPage.getByRole("radio", { name: "Perto de mim" }).click();
        await deniedPage.getByRole("button", { name: "Usar minha localização" }).click();
        await deniedPage.getByRole("status").filter({ hasText: /Tudo bem|não informa a posição/i }).waitFor({ timeout: 8000 });
        await deniedPage.getByRole("radio", { name: "Uma cidade" }).waitFor();
        record({ name: "discovery-gps-denied", result: "PASS", evidence: await shot(deniedPage, "discovery-gps-denied") });
        await deniedCtx.close();
      } catch (error) {
        record({ name: "discovery-gps-denied", result: "FAIL", error: error.message });
      }

      try {
        const mobile = await browser.newContext({
          locale: "pt-BR",
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        });
        const mobilePage = await mobile.newPage();
        await mobilePage.goto(`${base}/descobrir`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await mobilePage.getByRole("radio", { name: "Uma cidade" }).waitFor();
        await mobilePage.getByRole("button", { name: "Procurar estabelecimentos" }).waitFor();
        record({ name: "discovery-mobile", result: "PASS", evidence: await shot(mobilePage, "discovery-mobile") });
        await mobile.close();
      } catch (error) {
        record({ name: "discovery-mobile", result: "FAIL", error: error.message });
      }

      await context.close();
      await browser.close();
    }
  }
} catch (error) {
  record({ name: "harness", result: "FAIL", error: error.message });
} finally {
  server.kill();
}

const summary = {
  generatedAt: new Date().toISOString(),
  base,
  pass: results.filter((row) => row.result === "PASS").length,
  fail: results.filter((row) => row.result === "FAIL").length,
  blocked: results.filter((row) => row.result === "BLOQUEADO").length,
  results,
};
writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
if (summary.fail > 0) process.exitCode = 1;
