/**
 * Staging-only Playwright suite. Never runs against production.
 *
 * Without authorized staging this script records BLOQUEADO and exits 0.
 * It does not invent PASS E2E.
 *
 * Required to execute (still never production):
 *   AGENDE_STAGING_ACCEPTANCE=fkpdudnnperufnmdwdlv
 *   AGENDE_STAGING_ORIGIN=http://127.0.0.1:3000
 *
 * Optional credentials (read-only login). Mutations stay off unless
 * AGENDE_STAGING_ALLOW_MUTATIONS=1 — default does not submit signup,
 * booking or Stripe LIVE. Checkout is only followed to a cs_test_ URL.
 *
 * Usage: npm run test:e2e:staging
 */
import {
  assertSafeE2eOrigin,
  createEvidenceDir,
  createRecorder,
  exitCodeFromResults,
  launchBrowser,
  loadPlaywright,
  resolveStagingConfig,
  writeSummary,
} from "./e2e-lib.mjs";

const STAGING_JOURNEYS = [
  { id: "pro-signup-submit", title: "Cadastro profissional" },
  { id: "pro-email-confirm", title: "Confirmação de e-mail" },
  { id: "pro-login-session", title: "Login profissional" },
  { id: "pro-create-workspace", title: "Criação de estabelecimento" },
  { id: "pro-choose-plan", title: "Escolha de plano" },
  { id: "pro-trial", title: "Trial" },
  { id: "pro-services", title: "Cadastro de serviços" },
  { id: "pro-team", title: "Cadastro de profissionais" },
  { id: "pro-hours", title: "Configuração de horários" },
  { id: "pro-agenda", title: "Gestão de agenda" },
  { id: "pro-clients", title: "Cadastro de clientes" },
  { id: "client-search-city", title: "Descoberta por cidade" },
  { id: "client-search-gps", title: "Descoberta por GPS" },
  { id: "client-search-global", title: "Busca global" },
  { id: "client-public-profile", title: "Perfil público" },
  { id: "client-choose-service", title: "Escolha de serviço" },
  { id: "client-choose-professional", title: "Escolha de profissional" },
  { id: "client-choose-slot", title: "Seleção de horário" },
  { id: "client-confirm-booking", title: "Confirmação de reserva" },
  { id: "client-booking-on-pro-agenda", title: "Reserva na agenda do profissional" },
  { id: "billing-plan-ui", title: "Visualização de plano" },
  { id: "billing-checkout-test", title: "Checkout TEST" },
  { id: "billing-checkout-return", title: "Retorno do pagamento TEST" },
  { id: "billing-subscription-update", title: "Atualização de assinatura" },
  { id: "billing-portal-test", title: "Customer Portal TEST" },
];

const MUTATION_JOURNEY_IDS = new Set([
  "pro-signup-submit",
  "pro-create-workspace",
  "pro-services",
  "pro-team",
  "pro-hours",
  "pro-clients",
  "client-confirm-booking",
  "billing-checkout-test",
  "billing-portal-test",
]);

const evidence = createEvidenceDir("staging");
const results = [];
const record = createRecorder(results);
const config = resolveStagingConfig(process.env);

let browser;
let missingBrowser = false;

async function cleanup() {
  if (browser) {
    try {
      await browser.close();
    } catch {
      /* already closed */
    }
    browser = null;
  }
}

function finish(extra = {}) {
  const summary = {
    generatedAt: new Date().toISOString(),
    kind: "staging-e2e",
    origin: config.origin ?? null,
    evidenceDir: evidence.dir,
    pass: results.filter((row) => row.result === "PASS E2E").length,
    fail: results.filter((row) => row.result === "FAIL").length,
    blocked: results.filter((row) => row.result === "BLOQUEADO").length,
    untested: results.filter((row) => row.result === "NÃO TESTADO").length,
    classification: "PASS E2E somente contra staging autorizado. Sem opt-in = BLOQUEADO.",
    results,
  };
  writeSummary(evidence.dir, summary);
  console.log(JSON.stringify(summary));
  process.exitCode = exitCodeFromResults({
    fail: extra.fail ?? summary.fail,
    missingBrowser: extra.missingBrowser ?? missingBrowser,
    missingBackend: extra.missingBackend ?? false,
  });
}

process.once("SIGINT", () => {
  void cleanup().finally(() => process.exit(130));
});
process.once("SIGTERM", () => {
  void cleanup().finally(() => process.exit(143));
});

if (config.result === "FAIL") {
  record({ name: "staging-guard", result: "FAIL", error: config.reason });
  finish({ fail: 1 });
} else if (!config.ready) {
  for (const journey of STAGING_JOURNEYS) {
    record({
      name: journey.id,
      title: journey.title,
      result: "BLOQUEADO",
      error: config.reason,
    });
  }
  finish();
} else {
  try {
    assertSafeE2eOrigin(config.origin, "AGENDE_STAGING_ORIGIN");
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
    }

    if (browser) {
      const page = await browser.newPage({ locale: "pt-BR", viewport: { width: 1280, height: 800 } });
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) {
          assertSafeE2eOrigin(frame.url(), "navegação");
        }
      });

      try {
        await page.goto(`${config.origin}/login`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.getByLabel(/e-mail/i).waitFor({ timeout: 15000 });
        const shot = `${evidence.dir}/staging-login.png`;
        await page.screenshot({ path: shot });
        record({ name: "staging-public-login", result: "PASS E2E", evidence: shot });
      } catch (error) {
        record({ name: "staging-public-login", result: "FAIL", error: error.message });
      }

      const hasPro = Boolean(config.professionalEmail && config.professionalPassword);
      const hasClient = Boolean(config.clientEmail && config.clientPassword);
      const mutationReason = config.allowMutations
        ? null
        : "Mutações desligadas (AGENDE_STAGING_ALLOW_MUTATIONS≠1). Suíte não cria conta, reserva nem cobrança.";

      for (const journey of STAGING_JOURNEYS) {
        if (journey.id.startsWith("pro-") && !hasPro) {
          record({
            name: journey.id,
            title: journey.title,
            result: "BLOQUEADO",
            error: "Credencial profissional de staging ausente (AGENDE_STAGING_PRO_EMAIL/PASSWORD).",
          });
          continue;
        }
        if ((journey.id.startsWith("client-") || journey.id === "client-booking-on-pro-agenda") && !hasClient && !config.salonSlug) {
          record({
            name: journey.id,
            title: journey.title,
            result: "BLOQUEADO",
            error: "Credencial cliente ou slug de salão de staging ausente.",
          });
          continue;
        }
        if (journey.id.startsWith("billing-") && !hasPro) {
          record({
            name: journey.id,
            title: journey.title,
            result: "BLOQUEADO",
            error: "Billing TEST exige sessão profissional de staging.",
          });
          continue;
        }
        if (mutationReason && MUTATION_JOURNEY_IDS.has(journey.id)) {
          record({
            name: journey.id,
            title: journey.title,
            result: "BLOQUEADO",
            error: mutationReason,
          });
          continue;
        }
        record({
          name: journey.id,
          title: journey.title,
          result: "NÃO TESTADO",
          error: "Staging autorizado, mas o passo ainda não tem automação de navegador nesta rodada.",
        });
      }
    }
  } catch (error) {
    record({ name: "harness", result: "FAIL", error: error.message });
  } finally {
    await cleanup();
  }
  finish();
}
