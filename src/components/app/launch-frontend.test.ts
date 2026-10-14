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
  assert.match(tokens, /\.agende-panel/);

  const shell = source("src/components/app/app-shell.tsx");
  assert.match(shell, /bg-sidebar/);
  assert.match(shell, /Início/);
  assert.match(shell, /Mais/);
  assert.match(shell, /lg:hidden/);

  const dashboard = source("src/components/app/professional-dashboard.tsx");
  assert.match(dashboard, /Olá, \{firstName\}!/);
  assert.match(dashboard, /Agenda de hoje/);
  assert.match(dashboard, /dias restantes de teste/);
  assert.match(dashboard, /Teste grátis/);
  assert.match(dashboard, /Gerenciar plano/);
  assert.match(dashboard, /\/app\/configuracoes\/assinatura/);
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

test("catalog and money modules explain the empty next step", () => {
  assert.match(source("src/components/catalog/directories.tsx"), /EmptyState/);
  assert.match(source("src/components/catalog/directories.tsx"), /Cadastrar o primeiro serviço/);
  assert.match(source("src/components/finance/finance-dashboard.tsx"), /EmptyState/);
  assert.match(source("src/components/inventory/inventory-dashboard.tsx"), /EmptyState/);
  assert.match(source("src/components/packages/packages-dashboard.tsx"), /EmptyState/);
});

test("discovery is honest and not limited to the city of residence", () => {
  const contract = source("src/lib/discovery/contract.ts");
  assert.match(contract, /DISCOVERY_BACKEND_READY = false/);
  assert.match(contract, /qualquer cidade/i);
  assert.match(contract, /Não usamos a cidade de residência/i);
  assert.match(contract, /Muriaé/);
  assert.match(contract, /Juiz de Fora/);
  assert.match(contract, /p_offset: sanitizeDiscoveryOffset/);
  const ui = source("src/components/discovery/location-discovery.tsx");
  assert.match(ui, /searchPublicWorkspacesAction/);
  assert.match(ui, /modeNearby/);
  assert.match(ui, /modeGlobal/);
  assert.match(ui, /loadMore/);
  assert.match(ui, /scenarioHint/);
  assert.match(source("src/lib/discovery/contract.ts"), /Perto de mim/);
  assert.match(source("src/lib/discovery/contract.ts"), /Nome do salão/);
  assert.match(source("src/app/descobrir/page.tsx"), /LocationDiscovery/);
  assert.match(source("src/app/cliente/descobrir/page.tsx"), /LocationDiscovery/);
  assert.match(source("src/components/client/client-shell.tsx"), /\/cliente\/descobrir/);
});
