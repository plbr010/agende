# Agendê — auditoria funcional (Cursor) — 09/10/2026

Branch: `cursor/launch-functional-audit`  
PR: https://github.com/plbr010/agende/pull/17  
Base: `main` @ `5935dd0`  
Escopo: fluxos de utilização (cliente, profissional, agenda, cadastro, usabilidade).  
Fora de escopo (Codex / PR #15): migrations, RLS, Edge Stripe, webhooks, CI, dependências globais.

## Ambiente

- Node 22, `npm ci`, Next.js 16.3.5 local em `http://localhost:3000`
- Supabase remoto do projeto Agendê **somente leitura anônima** (anon key) para páginas públicas
- Sem branch paga Supabase e sem contas reais / dados de clientes
- Autenticação ponta a ponta **bloqueada**: não há ambiente Auth isolado nem inbox de teste

## Fluxos realmente testados

| Fluxo | Como | Resultado |
| --- | --- | --- |
| Landing | Playwright 3 viewports + browser manual | PASS |
| Cadastro UI + `intent=client` | Playwright + browser | PASS (sem submit) |
| Login UI | Playwright + browser | PASS (sem sessão real) |
| Guards `/app` `/cliente` | HTTP 307 + browser redirect | PASS |
| Perfil público `/p/estudio-luna` | Playwright + browser + RPC anon | PASS |
| Agenda pública (trial expirado) | Playwright + browser | PASS (mensagem correta após fix) |
| SQL foundation/catalog/settings/agenda/booking | `node scripts/audit-local-flows.mjs` | PASS (5/5) |
| Unit/regression | `npm test` | PASS (157) |
| Lint / typecheck / build | npm scripts | PASS (33 rotas) |

## Bugs encontrados e corrigidos

1. **Serviço sem profissional** podia ser salvo e aparecia no perfil sem entrar no booking → exige ≥1 profissional; Solo pré-marca o único.
2. **Perfil listava serviços órfãos** → `bookablePublicServices` filtra pelos serviços da equipe publicada; link com `?servico=`.
3. **Cancelamento sem revalidate** → revalida `/cliente`, `/cliente/agendamentos`, `/app/agenda`.
4. **CTA pós-reserva morto** para profissional sem `client_profiles` → painel; convidado usa `intent=client`.
5. **Onboarding sem guia** → checklist no dashboard (serviço, jornada, link público).
6. **Agenda interna sem empty-state** útil → orientação para clientes/serviços/equipe.
7. **Trial expirado mostrava “não está público” em `/agendar`** enquanto o perfil abria → `workspace_unavailable` vira “Agenda temporariamente indisponível”; perfil mostra “Agenda temporariamente fechada”.

## Ainda bloqueado (não validado ponta a ponta)

- Cadastro + confirmação de e-mail reais
- Login positivo / logout / trial 7 dias autenticado
- Criação de salão, serviços, jornada e publicação com sessão
- Booking completo com slots em workspace com entitlement ativo
- Cancelamento / reagendamento autenticados no browser
- Dashboard autenticado e módulos Estoque/Pacotes/Financeiro/Relatórios/Avaliações com dados reais
- Avaliações e `list_my_reschedule_slots` no remoto (migrations sob Codex)
- Stripe Checkout / Portal sandbox

## Prontidão estimada (15/10/2026)

| Dimensão | Estimativa |
| --- | --- |
| Funcionalidades implementadas no código | ~85% |
| Funcionalidades **validadas** em uso real autenticado | ~35% |
| Superfície pública + guards + regressões locais | ~90% |
| Pronto para primeiros pagantes (end-to-end comercial) | **~45%** — falta Auth E2E isolado, entitlement vivo, migrations de reviews/reagendamento e Stripe sandbox |

## Evidências

- `docs/evidence/launch-functional-audit/browser-flows.json` (27 PASS)
- Screenshots em `docs/evidence/launch-functional-audit/*.png`
- Script executável: `node scripts/audit-browser-flows.mjs http://localhost:3000`

## Arquivos modificados (principais)

- `src/lib/validation/catalog.ts` (+ tests)
- `src/lib/workspace/public.ts` (+ tests)
- `src/lib/booking/actions.ts`, `queries.ts`, `validation.ts` (+ tests)
- `src/components/booking/*`, `workspace/public-profile.tsx`, `catalog/directories.tsx`, `agenda/agenda-board.tsx`
- `src/app/app/page.tsx`, `src/app/(auth)/cadastro/page.tsx`, `src/app/p/[slug]/*`
- `scripts/audit-browser-flows.mjs`, `docs/evidence/launch-functional-audit/*`
