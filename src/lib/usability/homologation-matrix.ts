export const HOMOLOGATION_STATUSES = [
  "PASS LOCAL",
  "PASS E2E",
  "FAIL",
  "BLOQUEADO",
  "NÃO TESTADO",
] as const;

export type HomologationStatus = (typeof HOMOLOGATION_STATUSES)[number];
export type HomologationOwner = "Cursor" | "Codex";
export type HomologationAudience = "profissional" | "cliente" | "financeiro";

export type HomologationJourney = {
  id: string;
  audience: HomologationAudience;
  title: string;
  status: HomologationStatus;
  evidence: string;
  owner: HomologationOwner;
  note: string;
};

/**
 * Launch homologation board.
 *
 * PASS LOCAL = unit, mock, PGlite or isolated Playwright against synthetic env.
 * PASS E2E = full browser journey against authorized staging services.
 * FAIL = incorrect behavior reproduced.
 * BLOQUEADO = missing backend, SMTP, Stripe TEST, sandbox session or authorization.
 * NÃO TESTADO = journey not executed yet.
 *
 * PASS LOCAL never means the product is ready for paying customers.
 */
export const HOMOLOGATION_JOURNEYS: readonly HomologationJourney[] = [
  {
    id: "pro-signup-ui",
    audience: "profissional",
    title: "Cadastro (UI pública)",
    status: "PASS LOCAL",
    evidence: "scripts/isolated-e2e.mjs cadastro-keyboard + signup-form.test.ts",
    owner: "Cursor",
    note: "Intenção, termos e teclado visíveis. O formulário não é submetido no runner isolado.",
  },
  {
    id: "pro-signup-submit",
    audience: "profissional",
    title: "Cadastro real e criação de conta",
    status: "BLOQUEADO",
    evidence: "suíte scripts/staging-e2e.mjs preparada; Auth/SMTP isolados pendentes",
    owner: "Codex",
    note: "Exige GoTrue + SMTP de teste. Sem caixa controlada não há prova de entrega.",
  },
  {
    id: "pro-email-confirm",
    audience: "profissional",
    title: "Confirmação de e-mail",
    status: "BLOQUEADO",
    evidence: "docs/codex/frontend-backend-contract.md §auth",
    owner: "Codex",
    note: "Callback /auth/callback e /auth/confirm dependem de SMTP e Site URL de staging.",
  },
  {
    id: "pro-login-ui",
    audience: "profissional",
    title: "Login (UI pública)",
    status: "PASS LOCAL",
    evidence: "scripts/isolated-e2e.mjs login + login-form",
    owner: "Cursor",
    note: "Campos e recuperação visíveis. Sessão real não é aberta neste runner.",
  },
  {
    id: "pro-login-session",
    audience: "profissional",
    title: "Login autenticado e cookie de sessão",
    status: "BLOQUEADO",
    evidence: "scripts/staging-e2e.mjs pro-login-session",
    owner: "Codex",
    note: "Precisa de conta confirmada em staging. /app isolado só prova o guard anônimo.",
  },
  {
    id: "pro-create-workspace",
    audience: "profissional",
    title: "Criação de estabelecimento",
    status: "PASS LOCAL",
    evidence: "PGlite + mock auth create_workspace; create-workspace-form.test",
    owner: "Cursor",
    note: "Persistência isolada. Browser autenticado continua BLOQUEADO sem sandbox.",
  },
  {
    id: "pro-choose-plan",
    audience: "profissional",
    title: "Escolha de plano no onboarding",
    status: "PASS LOCAL",
    evidence: "create-workspace-form + billing-controls.test.ts",
    owner: "Cursor",
    note: "UI de Solo/Equipe/Salão. Checkout TEST não foi aberto.",
  },
  {
    id: "pro-trial",
    audience: "profissional",
    title: "Trial de sete dias",
    status: "PASS LOCAL",
    evidence: "PGlite professional_trial_claims + create_workspace",
    owner: "Cursor",
    note: "SQL isolado. Relógio/trial real de staging não foi exercido neste PR.",
  },
  {
    id: "pro-services",
    audience: "profissional",
    title: "Cadastro de serviços",
    status: "PASS LOCAL",
    evidence: "PGlite save_service_with_professionals + catalog actions",
    owner: "Cursor",
    note: "Produção ainda responde PGRST202 nesta RPC. E2E autenticado BLOQUEADO.",
  },
  {
    id: "pro-team",
    audience: "profissional",
    title: "Cadastro de profissionais",
    status: "PASS LOCAL",
    evidence: "PGlite profile actions + team-admin PendingForm",
    owner: "Cursor",
    note: "Camada de ação isolada. UI autenticada não aberta neste runner.",
  },
  {
    id: "pro-hours",
    audience: "profissional",
    title: "Configuração de horários",
    status: "PASS LOCAL",
    evidence: "PGlite professional_working_hours + availability-editor",
    owner: "Cursor",
    note: "SQL e formulário locais. Jornada no navegador autenticado BLOQUEADA.",
  },
  {
    id: "pro-agenda",
    audience: "profissional",
    title: "Gestão de agenda",
    status: "PASS LOCAL",
    evidence: "PGlite set_appointment_status + agenda status lock",
    owner: "Cursor",
    note: "Não classificar agenda como pronta para clientes: sem E2E autenticado.",
  },
  {
    id: "pro-clients",
    audience: "profissional",
    title: "Cadastro de clientes internos",
    status: "PASS LOCAL",
    evidence: "PGlite catalog client actions",
    owner: "Cursor",
    note: "Ação isolada. Formulário autenticado não submetido em staging.",
  },
  {
    id: "client-directory-ui",
    audience: "cliente",
    title: "Diretório público e modos de busca (UI)",
    status: "PASS LOCAL",
    evidence: "scripts/isolated-e2e.mjs discovery-* + discovery contract tests",
    owner: "Cursor",
    note: "Copy Muriaé/Juiz de Fora, teclado, validação e vazio honesto. Sem listagem real.",
  },
  {
    id: "client-search-city",
    audience: "cliente",
    title: "Descoberta por cidade (listagem real)",
    status: "BLOQUEADO",
    evidence: "DISCOVERY_BACKEND_READY=false; produção PGRST202",
    owner: "Codex",
    note: "Adapter e paginação prontos. Sem search_public_workspaces não há resultados.",
  },
  {
    id: "client-search-gps",
    audience: "cliente",
    title: "Descoberta por GPS autorizado (listagem real)",
    status: "BLOQUEADO",
    evidence: "isolated-e2e prova reverse-geocode Juiz de Fora; RPC ausente",
    owner: "Codex",
    note: "GPS e cidade reverse-geocodificada PASS LOCAL. Listagem depende da mesma RPC.",
  },
  {
    id: "client-search-global",
    audience: "cliente",
    title: "Busca global por nome",
    status: "BLOQUEADO",
    evidence: "isolated-e2e não inventa salões; RPC ausente",
    owner: "Codex",
    note: "Modo global envia p_query e p_city null. Sem RPC a UI só mostra indisponível.",
  },
  {
    id: "client-public-profile",
    audience: "cliente",
    title: "Abertura do perfil público",
    status: "PASS LOCAL",
    evidence: "scripts/isolated-e2e.mjs public-not-found",
    owner: "Cursor",
    note: "Slug inexistente tratado. Salão real de staging NÃO TESTADO.",
  },
  {
    id: "client-choose-service",
    audience: "cliente",
    title: "Escolha de serviço",
    status: "PASS LOCAL",
    evidence: "public-booking-flow.test.ts",
    owner: "Cursor",
    note: "Fluxo de UI isolado. Catálogo vivo exige list_public_booking_catalog em staging.",
  },
  {
    id: "client-choose-professional",
    audience: "cliente",
    title: "Escolha de profissional",
    status: "PASS LOCAL",
    evidence: "public-booking-flow.test.ts skip-professional + teclado",
    owner: "Cursor",
    note: "Componente local. Staging autenticado não executado.",
  },
  {
    id: "client-choose-slot",
    audience: "cliente",
    title: "Seleção de horário",
    status: "PASS LOCAL",
    evidence: "booking catalog-availability + validation tests",
    owner: "Cursor",
    note: "Slots calculados em testes. list_public_available_slots de staging BLOQUEADO.",
  },
  {
    id: "client-confirm-booking",
    audience: "cliente",
    title: "Confirmação de reserva",
    status: "PASS LOCAL",
    evidence: "PGlite create_public_appointment + booking lock UI",
    owner: "Cursor",
    note: "Não é reserva real. Produção proibida; staging sem opt-in.",
  },
  {
    id: "client-booking-on-pro-agenda",
    audience: "cliente",
    title: "Reserva visível na agenda do profissional",
    status: "BLOQUEADO",
    evidence: "scripts/staging-e2e.mjs client-booking-on-pro-agenda",
    owner: "Codex",
    note: "Exige duas sessões de staging (cliente + profissional) e salão de teste.",
  },
  {
    id: "client-booking-production",
    audience: "cliente",
    title: "Confirmar reserva em produção",
    status: "BLOQUEADO",
    evidence: "proibido criar dados reais em produção",
    owner: "Codex",
    note: "Nunca homologar em agendeapp.online.",
  },
  {
    id: "billing-plan-ui",
    audience: "financeiro",
    title: "Visualização de plano e preços",
    status: "PASS LOCAL",
    evidence: "billing-controls.test.ts + pricing.test.ts",
    owner: "Cursor",
    note: "Preços e periodicidade renderizados. Nenhuma sessão Stripe aberta.",
  },
  {
    id: "billing-checkout-test",
    audience: "financeiro",
    title: "Redirecionamento para Checkout TEST",
    status: "BLOQUEADO",
    evidence: "scripts/staging-e2e.mjs billing-checkout-test",
    owner: "Codex",
    note: "Edge stripe-billing + chave TEST no Vault. Frontend recusa hosts fora de checkout.stripe.com.",
  },
  {
    id: "billing-checkout-return",
    audience: "financeiro",
    title: "Retorno do pagamento de teste",
    status: "PASS LOCAL",
    evidence: "billing-controls checkoutReturn success/cancelled",
    owner: "Cursor",
    note: "Copy não afirma ativação. Retorno real de cs_test_* não executado.",
  },
  {
    id: "billing-subscription-update",
    audience: "financeiro",
    title: "Atualização de assinatura após Checkout TEST",
    status: "BLOQUEADO",
    evidence: "webhook/staging Stripe TEST pendente",
    owner: "Codex",
    note: "Frontend não simula active. Entitlement vem do webhook.",
  },
  {
    id: "billing-portal-test",
    audience: "financeiro",
    title: "Acesso ao Customer Portal TEST",
    status: "BLOQUEADO",
    evidence: "scripts/staging-e2e.mjs billing-portal-test",
    owner: "Codex",
    note: "Portal só em billing.stripe.com. LIVE proibido nesta suíte.",
  },
] as const;

export function homologationCounts(rows: readonly HomologationJourney[] = HOMOLOGATION_JOURNEYS) {
  return {
    passLocal: rows.filter((row) => row.status === "PASS LOCAL").length,
    passE2e: rows.filter((row) => row.status === "PASS E2E").length,
    fail: rows.filter((row) => row.status === "FAIL").length,
    blocked: rows.filter((row) => row.status === "BLOQUEADO").length,
    untested: rows.filter((row) => row.status === "NÃO TESTADO").length,
    total: rows.length,
  };
}

/**
 * Frontend evidence is local proof only. Commercial readiness requires PASS E2E.
 */
export function homologationReadiness(rows: readonly HomologationJourney[] = HOMOLOGATION_JOURNEYS) {
  const counts = homologationCounts(rows);
  const cursorOwned = rows.filter((row) => row.owner === "Cursor");
  const cursorProven = cursorOwned.filter(
    (row) => row.status === "PASS LOCAL" || row.status === "PASS E2E",
  );
  const sensitive = rows.filter((row) =>
    ["profissional", "financeiro"].includes(row.audience) ||
    row.id.startsWith("client-confirm") ||
    row.id.startsWith("client-booking"),
  );
  const sensitiveClaimedReady = sensitive.filter((row) => row.status === "PASS E2E").length;

  return {
    frontendOwnedReadyPercent:
      cursorOwned.length === 0 ? 0 : Math.round((100 * cursorProven.length) / cursorOwned.length),
    localEvidencePercent: Math.round((100 * counts.passLocal) / counts.total),
    realE2ePercent: Math.round((100 * counts.passE2e) / counts.total),
    blockedPercent: Math.round((100 * counts.blocked) / counts.total),
    sensitiveJourneysReadyPercent:
      sensitive.length === 0 ? 0 : Math.round((100 * sensitiveClaimedReady) / sensitive.length),
    commercialReady: counts.passE2e > 0 && counts.fail === 0 && counts.blocked === 0 && counts.untested === 0,
    disclaimer:
      "PASS LOCAL não conta como homologação real. Cadastro, agenda, financeiro e assinatura só são funcionais com PASS E2E.",
  };
}
