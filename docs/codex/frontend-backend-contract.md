# Contrato frontend → Codex (jornadas bloqueadas)

Somente o que o frontend já chama ou precisa para desbloquear **PASS E2E**. Não altera migrations, Stripe LIVE, SMTP produtivo nem DNS. Staging isolado (`fkpdudnnperufnmdwdlv`) é o alvo; produção (`wohimauqgywshbbejjcl`) está fora.

Permissões comuns: funções `SECURITY DEFINER` no schema `app`, expostas via wrappers `public`, `search_path` vazio, RLS + FORCE RLS. Anon só nas RPCs públicas de descoberta/reserva. Authenticated para o restante. Erros de contrato ausente: PostgREST `PGRST202` / Postgres `42883` — a UI já trata como “ainda não está no ar”, sem inventar dados.

## Auth e onboarding

| Jornada desbloqueada | RPC / endpoint | Entrada | Sucesso | Erros | Permissão |
| --- | --- | --- | --- | --- | --- |
| `pro-signup-submit` | GoTrue `signUp` + SMTP TEST | e-mail, senha, `intended_use`, telefone | usuário criado, e-mail enfileirado, sem sessão se confirm-email ativo | `email_address_invalid`, rate limit, e-mail já usado | anon |
| `pro-email-confirm` | `/auth/callback`, `/auth/confirm` | `code` / token de e-mail | cookie de sessão, `email_confirmed_at` | token expirado, origem fora do allowlist | anon + Site URL de staging |
| `pro-login-session` | GoTrue `signInWithPassword` | e-mail + senha confirmados | sessão + redirect `/app` ou `/cliente` | credencial inválida, e-mail não confirmado | anon |
| `pro-create-workspace` | `create_workspace` | `p_name` text, `p_plan` solo\|equipe\|salao | workspace + trial 7 dias | `email_not_confirmed`, `invalid_workspace_name` | authenticated, e-mail confirmado |
| `pro-trial` | `subscriptions` via `create_workspace` | — | `status=trialing`, `trial_ends_at = trial_started_at + 7d` | segundo trial (`professional_trial_claims`) | authenticated |

SMTP: caixa TEST controlada. Sem isso cadastro/confirm/reset ficam **BLOQUEADO**.

## Catálogo e agenda profissional

| Jornada | RPC / tabela | Entrada | Sucesso | Erros | Permissão |
| --- | --- | --- | --- | --- | --- |
| `pro-services` | `save_service_with_professionals` | `p_workspace_id`, `p_service_id` (null=novo), `p_name`, `p_description`, `p_duration_minutes`, `p_price_cents`, `p_active`, `p_professional_member_ids uuid[]` | uuid do serviço | `PGRST202` (ausente em produção), `invalid_professionals`, `services_duration`, `services_price` | owner/admin |
| `pro-team` | insert/update `workspace_members` + `create_workspace_invite` / `accept_workspace_invite` | `p_workspace_id`, `p_role`, `p_email` / `p_token` | membro ou convite | IDOR outro salão, elevação para owner | owner/admin |
| `pro-hours` | `professional_working_hours` | `workspace_id`, `professional_member_id`, `weekday` 0–6, `start_time`, `end_time` | jornada persistida | profissional de outro workspace | owner/admin/professional (própria) |
| `pro-agenda` | `set_appointment_status` | `p_appointment_id`, `p_status` | status avançado | transição inválida, outro salão | membro do workspace |
| `pro-clients` | ações de clientes internos (já no Git) | nome, telefone BR | cliente do workspace | `invalid_phone`, `client_identity_immutable` | owner/admin/receptionist |

Produção: `save_service_with_professionals` ainda falta. Staging já teve a RPC nos testes PostgREST do Codex — precisa estar no projeto que o frontend Preview usa.

## Descoberta pública

Contrato detalhado: `docs/discovery/backend-contract.md`. Flag `DISCOVERY_BACKEND_READY` permanece `false` até o probe passar.

| Jornada | RPC | Entrada v1 | Resposta | Erros | Permissão |
| --- | --- | --- | --- | --- | --- |
| `client-search-city` | `search_public_workspaces` | `p_city` ≥2, `p_state` `[A-Z]{2}` opcional, `p_query` opcional, `p_postal_code` null, `p_limit` 20, `p_offset` | `{ items: [{ name, slug, description, city, state, logo_path, booking_open }], total }` | `PGRST202`, validação vazia | anon + authenticated |
| `client-search-gps` | mesma RPC | cidade reverse-geocodificada (não residência). **Sem** `p_latitude`/`p_longitude` no v1 | igual | igual | anon |
| `client-search-global` | mesma RPC | `p_query` ≥2, `p_city` null | igual | recusar exigir cidade | anon |
| sugestões | `list_public_localities` | `p_state`, `p_query`, `p_limit` | `{ localities: [{ city, state, workspace_count }] }` | `PGRST202` | anon |

Não injetar cidade de residência. Não inventar estabelecimentos.

## Reserva pública e verificação na agenda

| Jornada | RPC | Entrada | Sucesso | Erros | Permissão |
| --- | --- | --- | --- | --- | --- |
| `client-public-profile` | `get_public_workspace_profile` | `p_slug` | JSON do salão ou vazio | slug inexistente → 404 de UI | anon |
| `client-choose-service` | `list_public_booking_catalog` | `p_slug` | serviços + profissionais + preços snapshot | entitlement fechado | anon |
| `client-choose-slot` | `list_public_available_slots` | `p_slug`, `p_service_id`, `p_professional_member_id`, `p_local_date` | `{ starts_at }[]` | sem jornada, lead time | anon |
| `client-confirm-booking` | `create_public_appointment` | `p_slug`, `p_service_id`, `p_professional_member_id`, `p_starts_at`, `p_full_name`, `p_phone`, `p_email`, `p_customer_note`, `p_ip_hash` | comprovante; concorrência: um vencedor | overlap, slot passado | anon |
| `client-booking-on-pro-agenda` | `appointments` + `list_my_appointments` | sessão profissional / cliente | o mesmo id nas duas UIs | IDOR outro salão | authenticated |

Homologar só em staging com salão fictício. Produção permanece **BLOQUEADO**.

## Billing TEST (nunca LIVE)

| Jornada | Endpoint | Entrada | Sucesso | Erros | Permissão |
| --- | --- | --- | --- | --- | --- |
| `billing-checkout-test` | Edge `stripe-billing` `createCheckout` | `workspaceId` da sessão, `plan`, `billingInterval`, `idempotencyKey` ≥16, `successPath` / `cancelPath` internos | `{ url }` https `checkout.stripe.com` com `cs_test_` | `auth_required`, `plan_seat_limit_exceeded`, `checkout_in_progress`, livemode | owner/admin, chave TEST |
| `billing-checkout-return` | query `?checkout=success\|cancelled` | — | copy local, **sem** afirmar ativação | — | frontend |
| `billing-subscription-update` | webhook `stripe-webhook` TEST | eventos TEST, HMAC | `subscriptions.status` alinhado | assinatura inválida, `livemode` true | Edge + Vault |
| `billing-portal-test` | `createPortal` | `workspaceId`, `returnPath` | `{ url }` https `billing.stripe.com` | `billing_customer_missing` | owner/admin + customer TEST |

O frontend só aceita hosts `checkout.stripe.com` e `billing.stripe.com`, sem credenciais na URL. Recusar `cs_live_`.

## O que o Cursor já fez e não deve ser refeito

- Adapter de descoberta, paginação, GPS opt-in, copy Muriaé/Juiz de Fora, estado vazio honesto.
- `save_service_with_professionals` no cliente, com mensagem se a RPC não existir.
- Checkout/portal com validação de redirect e copy que não afirma ativação.
- Runner isolado + suíte de staging opt-in + matriz PASS LOCAL / PASS E2E / BLOQUEADO.

## Área da cliente (Fase 1 frontend)

Detalhe: [client-experience-fase1.md](./client-experience-fase1.md). Favoritos, foto, cidade, preferências de notificação e rascunho de reserva pós-login **não** devem ser improvisados no browser.

## Como desbloquear PASS E2E

1. Preview/local apontando só para o projeto staging, nunca para produção.
2. SMTP TEST + duas contas fixture (profissional e cliente) + um slug de salão.
3. RPCs de descoberta no staging (e, se autorizado, em produção).
4. `save_service_with_professionals` no backend que o frontend Preview usa.
5. Stripe TEST + webhook + Vault; zero objetos LIVE.
6. Rodar `npm run test:e2e:staging` com as variáveis de [e2e.md](../homologation/e2e.md).
