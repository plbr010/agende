# Área da cliente — Fase 1 (frontend) → Codex

O frontend da área da cliente está no ar com dados reais já disponíveis (`list_my_appointments`, `profiles.full_name/phone`, descoberta pública). **Não há persistência local de favoritos, cidade, foto ou notificações.** Staging isolado (`fkpdudnnperufnmdwdlv`) é o alvo. Produção fora. Sem service role no navegador.

## Já coberto no frontend (não refazer)

| Superfície | Contrato usado | Comportamento honesto |
| --- | --- | --- |
| Escolha de perfil | marketing | Copy aprovada; cliente não vê preço SaaS |
| Explorar anônimo | `search_public_workspaces` / descoberta | Sem login |
| Reserva pública | `list_public_booking_catalog`, `list_public_available_slots`, `create_public_appointment` | Login só na confirmação (contexto pós-login = Fase 2) |
| Início / agendamentos / histórico | `list_my_appointments` | Vazio se não houver linhas da sessão |
| Cancelar / reagendar | `cancel_my_appointment`, `reschedule_my_appointment` | Só quando `canClientCancel` |
| Agendar novamente | `/p/{slug}/agendar?servico=` | Nova escolha de horário |
| Perfil nome/telefone | `UPDATE profiles (full_name, phone)` + RLS `profiles_update_own` | E-mail somente leitura |
| Favoritos UI | nenhum | Aviso de contrato ausente |
| Avaliações | `appointment_reviews` / `submit_appointment_review` | Notice se schema/RPC ausente |

## Bloqueado até o Codex entregar

### 1. Favoritos de estabelecimento (P0 da Fase 2)

Tabela sugerida: `public.client_workspace_favorites`

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `user_id` | uuid PK/FK → `profiles.user_id` | dono |
| `workspace_id` | uuid PK/FK → `workspaces.id` | estabelecimento publicado |
| `created_at` | timestamptz | |

RLS: FORCE RLS. SELECT/INSERT/DELETE somente `user_id = auth.uid()`. Estabelecimento precisa estar publicado para descoberta (`get_workspace_discovery` verdadeiro); não favoritar salão de outro tenant “às cegas”. Isolamento: o estabelecimento **não** lê favoritos de clientes de outros salões.

RPCs `SECURITY DEFINER` no schema `app`, wrappers `public`:

| RPC | Entrada | Sucesso | Erros |
| --- | --- | --- | --- |
| `list_my_workspace_favorites` | — | `{ items: [{ workspace_id, name, slug, city, state, logo_path }], total }` só do `auth.uid()` | `email_not_confirmed` |
| `add_my_workspace_favorite` | `p_workspace_id` | upsert idempotente | `workspace_not_found`, `workspace_unpublished` |
| `remove_my_workspace_favorite` | `p_workspace_id` | noop se inexistente | — |

Permissão: `authenticated`, e-mail confirmado, `client_profiles` presente. Anon: nenhuma. Sem `localStorage`.

### 2. Favoritos de profissional (P1, segunda etapa)

Só depois de (1). Mesmo padrão com `professional_member_id` + `workspace_id`. Não misturar com clientes internos do salão.

### 3. Cidade no perfil do cliente (P1)

`profiles` hoje: `full_name, email, phone, intended_use`. Sem cidade. Se precisar: coluna opcional + GRANT UPDATE explícito + RLS own-row. Não usar cidade de residência na descoberta (contrato já existente).

### 4. Foto de perfil (P1)

Bucket privado, path `avatars/{user_id}/...`, políticas INSERT+SELECT+UPDATE do dono, sem URL pública adivinhável. Sem upload até isso existir.

### 5. Preferências de notificação (P1)

Tabela `client_notification_preferences` (`user_id`, flags de confirmação/lembrete/avaliação). Só persistir se o envio real (e-mail/WhatsApp) já existir. Não afirmar envio sem confirmação.

### 6. Preservar contexto da reserva após login (Fase 2, frontend+auth)

Fluxo: Explorar → serviço → profissional → horário → login/cadastro → voltar ao confirm com os mesmos `slug`, `service_id`, `professional_member_id`, `starts_at`. Revalidar `list_public_available_slots` antes de `create_public_appointment`. Não bloquear horário sem suporte de backend. `next` já é sanitizado em `sanitizeNextPath`; falta serializar o rascunho da reserva de forma segura (cookie httpOnly ou query assinada curta), nunca em `user_metadata`.

## Segurança (obrigatório)

- Cada cliente lê só os próprios favoritos, agendamentos, histórico, avaliações e perfil.
- Estabelecimento não consulta atendimentos privados feitos em outro tenant.
- Sem service role no browser.
- Erros de RPC ausente: `PGRST202` / `42883` → UI “ainda não está no ar”.

## Como desbloquear

1. Migration + RLS + RPCs em **staging**.
2. Tipos gerados / contrato no `database.types.ts`.
3. Aviso no frontend some só depois do probe passar.
4. PR separado, sem merge automático, sem produção.
