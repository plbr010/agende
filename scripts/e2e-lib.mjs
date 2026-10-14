/**
 * Shared helpers for isolated and staging Playwright runners.
 * Never navigate to production. Evidence paths stay relative to the workspace.
 */
import { createServer } from "node:net";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const STAGING_ACCEPTANCE = "fkpdudnnperufnmdwdlv";

export const FORBIDDEN_PRODUCTION_HOSTS = Object.freeze([
  "agendeapp.online",
  "www.agendeapp.online",
  "agende-lac.vercel.app",
  "wohimauqgywshbbejjcl.supabase.co",
]);

export const FORBIDDEN_PRODUCTION_MARKERS = Object.freeze([
  ...FORBIDDEN_PRODUCTION_HOSTS,
  "wohimauqgywshbbejjcl",
]);

export function hostnameOf(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value).includes("://") ? String(value) : `https://${value}`);
    return url.hostname.replace(/\.$/, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isForbiddenProductionOrigin(value) {
  if (!value) return false;
  const lower = String(value).toLowerCase();
  if (FORBIDDEN_PRODUCTION_MARKERS.some((marker) => lower.includes(marker))) return true;
  return FORBIDDEN_PRODUCTION_HOSTS.includes(hostnameOf(value) ?? "");
}

export function assertSafeE2eOrigin(value, label = "origem") {
  if (isForbiddenProductionOrigin(value)) {
    throw new Error(`E2E recusou ${label} de produção: ${value}`);
  }
}

export function scanEnvForProduction(env = process.env) {
  const hits = [];
  for (const [key, value] of Object.entries(env)) {
    if (!value || typeof value !== "string") continue;
    if (!/URL|ORIGIN|HOST|SITE|SUPABASE|STRIPE|AGENDE/i.test(key)) continue;
    if (isForbiddenProductionOrigin(value)) hits.push(key);
  }
  return hits;
}

export function isLoopbackHost(hostname) {
  const host = (hostname ?? "").replace(/^\[|\]$/g, "").toLowerCase();
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function isAllowedStagingOrigin(value) {
  if (!value || isForbiddenProductionOrigin(value)) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  if (isLoopbackHost(host)) return url.protocol === "http:" || url.protocol === "https:";
  if (url.protocol !== "https:") return false;
  return host.includes("staging");
}

export function resolvePort(requested) {
  if (requested == null || requested === "") {
    return getFreePort();
  }
  const port = Number(requested);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return Promise.reject(new Error(`AGENDE_E2E_PORT inválida: ${requested}`));
  }
  return Promise.resolve(port);
}

export function getFreePort() {
  return new Promise((resolvePortPromise, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Não foi possível alocar uma porta livre")));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolvePortPromise(port)));
    });
  });
}

export function createEvidenceDir(prefix, env = process.env, cwd = process.cwd()) {
  const root = env.AGENDE_E2E_EVIDENCE
    ? resolve(cwd, env.AGENDE_E2E_EVIDENCE)
    : join(cwd, "artifacts", "e2e");
  const dir = join(root, `${prefix}-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return { root, dir };
}

export function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    return null;
  }
}

export async function launchBrowser(chromium) {
  const common = { headless: true };
  try {
    return await chromium.launch({ ...common, channel: "chrome" });
  } catch {
    return chromium.launch(common);
  }
}

export function stopChild(child, signal = "SIGTERM") {
  if (!child || child.killed || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolveStop) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        try {
          child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
      }
    }, 4000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolveStop();
    });
    try {
      child.kill(signal);
    } catch {
      clearTimeout(timer);
      resolveStop();
    }
  });
}

export function writeSummary(dir, summary) {
  const path = join(dir, "summary.json");
  writeFileSync(path, `${JSON.stringify(summary, null, 2)}\n`);
  return path;
}

export function exitCodeFromResults({ fail = 0, missingBrowser = false, missingBackend = false } = {}) {
  if (fail > 0) return 1;
  if (missingBrowser) return 2;
  if (missingBackend) return 3;
  return 0;
}

export function resolveStagingConfig(env = process.env) {
  const origin = env.AGENDE_STAGING_ORIGIN?.trim() ?? "";
  const acceptance = env.AGENDE_STAGING_ACCEPTANCE?.trim() ?? "";
  const allowMutations = env.AGENDE_STAGING_ALLOW_MUTATIONS === "1";

  if (!origin && !acceptance) {
    return {
      ready: false,
      result: "BLOQUEADO",
      reason: "Staging não configurado. Defina AGENDE_STAGING_ACCEPTANCE e AGENDE_STAGING_ORIGIN. Não executado contra produção.",
    };
  }

  if (origin && isForbiddenProductionOrigin(origin)) {
    return {
      ready: false,
      result: "FAIL",
      reason: `Origem de produção recusada: ${origin}`,
    };
  }

  if (origin && !isAllowedStagingOrigin(origin)) {
    return {
      ready: false,
      result: "FAIL",
      reason: `Origem de staging inválida (use loopback ou hostname com "staging"): ${origin}`,
    };
  }

  if (acceptance !== STAGING_ACCEPTANCE) {
    return {
      ready: false,
      result: "BLOQUEADO",
      reason: "AGENDE_STAGING_ACCEPTANCE ausente ou diferente do projeto isolado autorizado.",
    };
  }

  if (!origin) {
    return {
      ready: false,
      result: "BLOQUEADO",
      reason: "AGENDE_STAGING_ORIGIN ausente. Informe um origin loopback ou hostname de staging.",
    };
  }

  return {
    ready: true,
    result: "ready",
    origin: origin.replace(/\/$/, ""),
    allowMutations,
    professionalEmail: env.AGENDE_STAGING_PRO_EMAIL ?? "",
    professionalPassword: env.AGENDE_STAGING_PRO_PASSWORD ?? "",
    clientEmail: env.AGENDE_STAGING_CLIENT_EMAIL ?? "",
    clientPassword: env.AGENDE_STAGING_CLIENT_PASSWORD ?? "",
    salonSlug: env.AGENDE_STAGING_SALON_SLUG ?? "",
  };
}

export function createRecorder(results) {
  return function record(entry) {
    results.push(entry);
    console.log(JSON.stringify(entry));
    return entry;
  };
}
