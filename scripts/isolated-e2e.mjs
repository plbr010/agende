/**
 * Isolated public-journey browser tests.
 * Starts the already-built app with synthetic env. Never hits production.
 * Submits only invalid signup data rejected locally before Auth; no account/booking/billing writes.
 * Requires a build with the documented CI placeholder URL/key, not a staging build.
 *
 * Usage:
 *   npm run build && npm run test:e2e
 *
 * Optional env:
 *   AGENDE_E2E_PORT       fixed port (default: first free port on 127.0.0.1)
 *   AGENDE_E2E_EVIDENCE   evidence directory (default: ./artifacts/e2e)
 *
 * Exit codes: 0 ok · 1 test FAIL · 2 browser missing · 3 server/backend missing
 */
import {readFileSync,readdirSync} from "node:fs";
import { spawn } from "node:child_process";
import {
  assertSafeE2eOrigin,
  createEvidenceDir,
  createRecorder,
  classifyLocalE2e,
  exitCodeFromResults,
  launchBrowser,
  loadPlaywright,
  resolvePort,
  scanEnvForProduction,
  stopChild,
  writeSummary,
} from "./e2e-lib.mjs";

const evidence = createEvidenceDir("isolated");
const results = [];
const record = createRecorder(results);
const port = await resolvePort(process.env.AGENDE_E2E_PORT);
const base = `http://127.0.0.1:${port}`;
assertSafeE2eOrigin(base, "base isolada");

const leaked = scanEnvForProduction(process.env);
if (leaked.length) {
  record({
    name: "production-guard",
    result: "FAIL",
    error: `Variáveis apontam para produção e o runner isolado recusou seguir: ${leaked.join(", ")}`,
  });
  const summary = {
    generatedAt: new Date().toISOString(),
    kind: "isolated-e2e",
    base,
    evidenceDir: evidence.dir,
    pass: 0,
    fail: 1,
    blocked: 0,
    classification: classifyLocalE2e(results),
    results,
  };
  writeSummary(evidence.dir, summary);
  console.log(JSON.stringify(summary));
  process.exit(1);
}

let server;
let browser;
let missingBrowser = false;
let missingBackend = false;

function finish(extra = {}) {
  const summary = {
    generatedAt: new Date().toISOString(),
    kind: "isolated-e2e",
    base,
    evidenceDir: evidence.dir,
    pass: results.filter((row) => row.result === "PASS").length,
    fail: results.filter((row) => row.result === "FAIL").length,
    blocked: results.filter((row) => row.result === "BLOQUEADO").length,
    classification: classifyLocalE2e(results),
    results,
  };
  writeSummary(evidence.dir, summary);
  console.log(JSON.stringify(summary));
  process.exitCode = exitCodeFromResults({
    fail: extra.fail ?? summary.fail,
    missingBrowser: extra.missingBrowser ?? missingBrowser,
    missingBackend: extra.missingBackend ?? missingBackend,
  });
}

async function cleanup() {
  if (browser) {
    try {
      await browser.close();
    } catch {
      /* already closed */
    }
    browser = null;
  }
  await stopChild(server);
}

process.once("SIGINT", () => {
  void cleanup().finally(() => process.exit(130));
});
process.once("SIGTERM", () => {
  void cleanup().finally(() => process.exit(143));
});

try {
  const chunks=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?chunks(`${dir}/${e.name}`):e.name.endsWith('.js')?[`${dir}/${e.name}`]:[]);
  const built=[...chunks('.next/static'),...chunks('.next/server')].map(p=>readFileSync(p,'utf8'));
  if(!built.some(s=>s.includes('https://example.supabase.co'))||!built.some(s=>s.includes('sb_publishable_ci_placeholder'))) throw new Error('Isolated build requires CI placeholder URL/key at build time; runtime overrides do not replace bundled NEXT_PUBLIC values. Rebuild before this runner.');
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_placeholder",
      NEXT_PUBLIC_SITE_URL: base,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Local server did not become ready")), 60_000);
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
      reject(new Error(`Local server exited with ${code}. Rode npm run build antes de npm run test:e2e.`));
    });
  });

  const playwright = loadPlaywright();
  if (!playwright) {
    missingBrowser = true;
    record({ name: "playwright", result: "BLOQUEADO", error: "pacote playwright ausente neste ambiente" });
  } else {
    try {
      browser = await launchBrowser(playwright.chromium);
    } catch (error) {
      missingBrowser = true;
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
        const path = `${evidence.dir}/${name}.png`;
        await page.screenshot({ path, fullPage: false });
        return path;
      }

      const page = await context.newPage();
      try {
        for (const width of [1280, 390]) {
          await page.setViewportSize({width,height:844});
          for (const route of ["/", "/profissionais"]) {
            await page.goto(base+route,{waitUntil:"domcontentloaded"});
            const links=page.getByRole("link",{name:"Fale com um especialista",exact:true});
            if(await links.count()===0)throw Error("missing commercial contact");
            for(const link of await links.all()) {
              const href=new URL(await link.getAttribute("href"));
              if(href.origin!=="https://wa.me"||href.pathname!=="/5532998064217"||!href.searchParams.get("text")?.includes("Conheci o Agendê"))throw Error("invalid contact destination/message");
              if(await link.getAttribute("target")!=="_blank")throw Error("missing new-tab target");
            }
            if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error("horizontal overflow");
            await links.first().scrollIntoViewIfNeeded();
            record({name:"commercial-whatsapp-"+width+route,result:"PASS",evidence:await shot(page,"whatsapp-"+width+(route==="/"?"-home":"-commercial"))});
          }
        }
        await page.setViewportSize({width:1280,height:800});
        await page.goto(base+"/cadastro?intent=professional",{waitUntil:"domcontentloaded"});
        if(await page.locator('input[name=intendedUse]').inputValue()!=="professional")throw Error("professional signup intent lost");
        record({name:"professional-signup-separated",result:"PASS",evidence:await shot(page,"professional-signup")});
        await page.goto(base+"/login?next=%2Fcliente%2Fdescobrir",{waitUntil:"domcontentloaded"});
        await page.getByRole("link",{name:"Criar conta grátis",exact:true}).click();
        if(await page.locator('input[name=next]').inputValue()!=="/cliente/descobrir"||await page.locator('input[name=intendedUse]').inputValue()!=="client")throw Error("client return/intent lost");
        record({name:"login-client-discovery-return",result:"PASS"});
      } catch(error) {record({name:"integrated-commercial-flow",result:"FAIL",error:error.message});}


      try {
        await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.getByRole("link", { name: /Sou profissional/i }).first().waitFor();
        const landingHtml = await page.content();
        if (/href="\/descobrir"[^>]*>\s*Sou cliente/.test(landingHtml)) {
          throw new Error("Sou cliente still points to /descobrir");
        }
        if (!landingHtml.includes('href="/cadastro?intent=cliente&amp;next=%2Fcliente%2Fdescobrir"')) {
          throw new Error("homepage missing client signup href");
        }
        record({ name: "landing", result: "PASS", evidence: await shot(page, "landing") });
      } catch (error) {
        record({ name: "landing", result: "FAIL", error: error.message });
      }

      try {
        const mobile = await browser.newContext({
          locale: "pt-BR",
          viewport: { width: 390, height: 844 },
        });
        try {
          const splash = await mobile.newPage();
          await splash.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
          await splash.getByRole("link", { name: /^Sou cliente$/i }).click();
          await splash.waitForURL(/\/cadastro\?intent=cliente/);
          await splash.getByRole("heading", { name: "Criar conta de cliente", exact: true }).waitFor();
          if (new URL(splash.url()).pathname === "/descobrir") {
            throw new Error("Sou cliente opened the salon directory");
          }
          if (await splash.getByRole("heading", { name: "Como você quer usar o Agendê?", exact: true }).count()) {
            throw new Error("Sou cliente opened the account-type choice");
          }
          await splash.getByLabel(/^Nome$/).waitFor();
          await splash.getByLabel(/^E-mail$/).waitFor();
          await splash.getByRole("button", { name: "Criar conta de cliente", exact: true }).waitFor();
          record({ name: "client-cta-signup", result: "PASS", evidence: await shot(splash, "client-cta-signup") });
        } finally {
          await mobile.close();
        }
      } catch (error) {
        record({ name: "client-cta-signup", result: "FAIL", error: error.message });
      }

      try {
        await page.goto(`${base}/comecar`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.getByRole("link", { name: "Criar conta de cliente", exact: true }).click();
        await page.waitForURL(/\/cadastro\?intent=cliente/);
        await page.getByRole("heading", { name: "Criar conta de cliente", exact: true }).waitFor();
        record({ name: "comecar-client-signup", result: "PASS", evidence: await shot(page, "comecar-client-signup") });
      } catch (error) {
        record({ name: "comecar-client-signup", result: "FAIL", error: error.message });
      }

      try {
        await page.goto(`${base}/cadastro`, { waitUntil: "domcontentloaded", timeout: 20000 });
        const client = page.getByRole("link", { name: /Quero agendar serviços/i });
        const owner = page.getByRole("link", { name: /Tenho meu próprio salão/i });
        const team = page.getByRole("link", { name: /Trabalho em um salão parceiro/i });
        await client.waitFor();
        await owner.waitFor();
        await team.waitFor();
        await client.focus();
        await client.press("Enter");
        await page.getByRole("button", { name: /Criar conta de cliente/i }).waitFor();
        if (/R\$/.test(await page.locator("body").innerText())) {
          throw new Error("client signup showed a subscription price");
        }
        record({ name: "cadastro-keyboard", result: "PASS", evidence: await shot(page, "cadastro") });
      } catch (error) {
        record({ name: "cadastro-keyboard", result: "FAIL", error: error.message });
      }

      try {
        await page.goto(`${base}/cadastro?intent=cliente`, { waitUntil: "domcontentloaded", timeout: 20000 });
        for (const [name,value] of Object.entries({fullName:"Cliente Teste",email:"owned@example.invalid",phone:"123",password:"SyntheticAa9!",confirmPassword:"SyntheticAa9!"})) await page.locator(`input[name=${name}]`).fill(value);
        await page.getByRole("checkbox").check();
        await page.waitForFunction(() => document.querySelector('input[name=termsAccepted]')?.value === "true");
        await page.getByRole("button", {name:"Criar conta de cliente",exact:true}).click();
        await page.getByRole("alert").filter({hasText:"Confira os campos em vermelho."}).waitFor();
        for (const [name,value] of Object.entries({fullName:"Cliente Teste",email:"owned@example.invalid",password:"SyntheticAa9!"})) if (await page.locator(`input[name=${name}]`).inputValue() !== value) throw new Error("validation reset signup fields");
        record({name:"signup-validation-keeps-input",result:"PASS",evidence:await shot(page,"signup-validation-keeps-input")});
      } catch (error) {
        record({name:"signup-validation-keeps-input",result:"FAIL",error:error.message});
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
        const response=await page.goto(`${base}/verificar-email?status=session_unavailable`);
        if(response.status()!==200)throw new Error("session recovery view unavailable");
        await page.getByRole("heading",{name:"Tente entrar para continuar",exact:true}).waitFor();
        if(await page.getByRole("heading",{name:"E-mail confirmado",exact:true}).count())throw new Error("recovery view claims confirmation");
        await page.locator('a[href="/login"]').click();
        await page.waitForURL(`${base}/login`);
        record({name:"confirmation-session-recovery",result:"PASS"});
      } catch(error) {
        record({name:"confirmation-session-recovery",result:"FAIL",error:error.message});
      }

      try {
        const cold=await browser.newContext({javaScriptEnabled:false});
        try {
          const coldPage=await cold.newPage();await coldPage.goto(`${base}/descobrir`);
          if (!await coldPage.getByRole("button",{name:"Procurar estabelecimentos",exact:true}).isDisabled()) throw new Error("search submits natively before hydration");
          record({name:"discovery-before-hydration",result:"PASS"});
        } finally {await cold.close();}
      } catch (error) {
        record({name:"discovery-before-hydration",result:"FAIL",error:error.message});
      }

      try {
        await page.goto(`${base}/descobrir`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.getByText("A cidade pode ser qualquer uma", { exact: true }).click();
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
    }
  }
} catch (error) {
  missingBackend = /server|listen|EADDRINUSE|build|Ready/i.test(error.message);
  record({
    name: "harness",
    result: missingBackend ? "BLOQUEADO" : "FAIL",
    error: error.message,
  });
} finally {
  await cleanup();
}

finish();
