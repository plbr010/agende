import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function source(relative: string) {
  return readFileSync(join(root, relative), "utf8");
}

test("approved dashboard identity stays on the launch screens", () => {
  const tokens = source("src/app/globals.css");
  assert.match(tokens, /--wine-deep:\s*#5c1a2e/);
  assert.match(tokens, /--metric-blush:\s*#fff0ee/);
  assert.match(tokens, /\.agende-app/);

  const shell = source("src/components/app/app-shell.tsx");
  assert.match(shell, /bg-sidebar/);
  assert.match(shell, /Início/);
  assert.match(shell, /Mais/);
  assert.match(shell, /lg:hidden/);

  const dashboard = source("src/components/app/professional-dashboard.tsx");
  assert.match(dashboard, /Olá, \{firstName\}!/);
  assert.match(dashboard, /Agenda de hoje/);
  assert.match(dashboard, /dias restantes de teste/);
  assert.match(dashboard, /Gerenciar plano/);
  assert.doesNotMatch(dashboard, /4,9/);
});

test("auth, onboarding and billing keep the next step obvious", () => {
  assert.match(source("src/app/(auth)/login/page.tsx"), /AuthPanel/);
  assert.match(source("src/components/auth/login-form.tsx"), /PortugueseForm/);
  assert.match(source("src/components/auth/recovery-form.tsx"), /PasswordField/);
  assert.match(source("src/components/auth/recovery-form.tsx"), /PortugueseForm/);
  assert.match(source("src/components/workspace/create-workspace-form.tsx"), /Escolha seu plano/);
  assert.match(source("src/components/workspace/create-workspace-form.tsx"), /TRIAL_PLAIN/);
  assert.match(source("src/components/workspace/create-workspace-form.tsx"), /Sem cartão agora/);
  assert.match(source("src/components/billing/subscription-overview.tsx"), /dias restantes de teste/);
  assert.match(source("src/components/billing/billing-controls.tsx"), /Periodicidade/);
  assert.match(source("src/components/billing/billing-controls.tsx"), /Assinar \{plan.name\}/);
  assert.doesNotMatch(source("src/components/billing/billing-controls.tsx"), /Assinatura ativada/);
});
