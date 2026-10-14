export type HomologationStatus = "PASS" | "FAIL" | "BLOQUEADO";
export type HomologationOwner = "Cursor" | "Codex";

export type HomologationJourney = {
  id: string;
  audience: "profissional" | "cliente";
  title: string;
  status: HomologationStatus;
  evidence: string;
  owner: HomologationOwner;
  note: string;
};

/**
 * Launch homologation board. Browser PASS is only for isolated public pages.
 * Authenticated /app and production RPCs stay BLOQUEADO without a sandbox session.
 */
export const HOMOLOGATION_JOURNEYS: readonly HomologationJourney[] = [
  {
    id: "pro-signup-ui",
    audience: "profissional",
    title: "Cadastro (UI pública)",
    status: "PASS",
    evidence: "scripts/isolated-e2e.mjs + signup-form.test.ts",
    owner: "Cursor",
    note: "Intenção, termos e validação visíveis. Criar conta real exige Auth/SMTP (Codex).",
  },
  {
    id: "pro-login-ui",
    audience: "profissional",
    title: "Login (UI pública)",
    status: "PASS",
    evidence: "scripts/isolated-e2e.mjs + login-form",
    owner: "Cursor",
    note: "Formulário e recuperação visíveis. Sessão real exige Auth (Codex).",
  },
  {
    id: "pro-onboarding",
    audience: "profissional",
    title: "Onboarding / criar estabelecimento / trial",
    status: "PASS",
    evidence: "pglite_integration_with_mock_auth workspace create action",
    owner: "Cursor",
    note: "Persistência isolada no PGlite. Browser autenticado BLOQUEADO sem sandbox.",
  },
  {
    id: "pro-catalog",
    audience: "profissional",
    title: "Serviços, profissionais, horários e clientes",
    status: "PASS",
    evidence: "pglite profile/service/availability + catalog actions",
    owner: "Cursor",
    note: "Produção: save_service_with_professionals ausente (Codex).",
  },
  {
    id: "pro-agenda",
    audience: "profissional",
    title: "Agenda, cancelar e reagendar",
    status: "PASS",
    evidence: "pglite public booking + client reschedule + agenda status lock",
    owner: "Cursor",
    note: "Camada de ação isolada. UI autenticada não aberta neste runner.",
  },
  {
    id: "pro-money",
    audience: "profissional",
    title: "Financeiro, estoque, relatórios e assinatura",
    status: "PASS",
    evidence: "pglite finance/stock/packages + stripe_mocks",
    owner: "Cursor",
    note: "Stripe/portal reais são Codex. Frontend não simula ativação.",
  },
  {
    id: "client-directory",
    audience: "cliente",
    title: "Diretório público e modos de busca",
    status: "PASS",
    evidence: "scripts/isolated-e2e.mjs + discovery contract tests",
    owner: "Cursor",
    note: "Copy Muriaé/Juiz de Fora, teclado, validação e estado vazio honesto.",
  },
  {
    id: "client-search-rpc",
    audience: "cliente",
    title: "Listagem real por cidade, nome, GPS e paginação",
    status: "BLOQUEADO",
    evidence: "DISCOVERY_BACKEND_READY=false; produção PGRST202",
    owner: "Codex",
    note: "Adapter pronto. Sem RPC não há resultados reais nem paginação ao vivo.",
  },
  {
    id: "client-booking-isolated",
    audience: "cliente",
    title: "Reserva, horário indisponível e duplicata (ações isoladas)",
    status: "PASS",
    evidence: "pglite public actions book/reject overlap + booking lock UI",
    owner: "Cursor",
    note: "E2E de um salão real autenticado não foi aberto neste ambiente.",
  },
  {
    id: "client-booking-production",
    audience: "cliente",
    title: "Confirmar reserva em produção",
    status: "BLOQUEADO",
    evidence: "proibido criar dados reais em produção",
    owner: "Codex",
    note: "Homologar em sandbox com salão de teste, não em agendeapp.online.",
  },
] as const;

export function homologationCounts(rows: readonly HomologationJourney[] = HOMOLOGATION_JOURNEYS) {
  return {
    pass: rows.filter((row) => row.status === "PASS").length,
    fail: rows.filter((row) => row.status === "FAIL").length,
    blocked: rows.filter((row) => row.status === "BLOQUEADO").length,
    total: rows.length,
  };
}
