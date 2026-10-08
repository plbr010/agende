# Auditoria de lançamento — 08/10/2026

Lançamento previsto: 15/10/2026. Base: `main`, commit `3bd1acd` (PR #13).
Branch de trabalho: `codex/launch-2026-10-15-audit`.

## Ambiente e preservação

A sessão expôs Windows local, não um executor remoto Linux. A pasta inicial
`C:\Users\PLBR\Documents\Codex` não tinha `.git`. Foi usado o checkout
`2026-09-26/continue-o-projeto-agend-no-reposit`, cujo origin é
`https://github.com/plbr010/agende.git`. `pwd`, `git status --short`,
`git branch --show-current` e `git log -1 --oneline` foram executados.
O checkout estava limpo; alterações em outros checkouts foram preservadas.
Após fetch de main, a branch de trabalho foi criada sobre `origin/main`.

Node do PATH: 20.17.0, incompatível com engines >=22. Checks finais e instalação
limpa usaram explicitamente Node 24.19.0 e npm 10.8.2. `npm.cmd` do sistema
continua usando seu Node adjacente mesmo com PATH alterado; foi necessário
invocar npm-cli.js pelo executável Node 24.

## Correções

- Next.js e eslint-config-next: 16.3.5 → 16.3.8. Corrige a versão afetada pelos
  avisos de segurança do npm audit, incluindo
  [RCE em next/og](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j).
  A busca no aplicativo não encontrou uso de ImageResponse/next/og; isso não
  substitui a atualização do framework.
- Atualizações transitivas compatíveis: sharp 0.35.5, source-map-js 1.2.2 e
  @modelcontextprotocol/sdk 1.32.1, com lockfile atualizado. Não foi usado
  `npm audit fix --force`.
- A consulta de avaliações distingue schema ausente (`null`) de lista vazia
  (`[]`). As páginas profissional/cliente mostram indisponibilidade sem montar
  o formulário de envio quando a tabela não existe. Erros de permissão,
  autenticação e transporte continuam sendo erros, sem virar lista vazia.
- A action de avaliações trata RPC ausente e não anuncia sucesso. Após uma
  escrita bem-sucedida, falha de leitura não estimula reenvio cego.
- Auditoria HTTP reutilizável aceita somente preview HTTPS Vercel ou origem
  HTTP loopback, inclui recuperação de senha e callbacks sem token. O runner
  inicia o build local com configuração fictícia e encerra o servidor no fim.
  `npm run test:smoke` passa a rodar no CI depois do build.

## Testes executados

| Verificação | Resultado | Limite da evidência |
| --- | --- | --- |
| npm ci | PASS | Instalação limpa do lockfile final com Node 24 |
| npm run lint | PASS | Código e scripts locais |
| npm run typecheck | PASS | Tipos de rotas e TypeScript |
| npm test | PASS | 145 testes; zero falhas/skips, incluindo 4 regressões novas |
| npm run build | PASS | Next.js 16.3.8, geração estática 33/33 |
| node scripts/audit-local-flows.mjs | PASS | 5 suítes SQL, 99 cenários identificados |
| node scripts/verify-stripe-recovery.mjs | PASS | Integridade histórica e hashes contra snapshot de 27/09 |
| npm run test:smoke | PASS | 32 sondagens GET do build local, sem sessão |
| git diff --check | PASS | Sem erros de whitespace |
| npm audit | PENDÊNCIA | 9 avisos high; zero críticos; cadeia de braces |

O primeiro build restrito falhou na criação de subprocessos do Turbopack.
`npm ci` também encontrou EPERM no sandbox. Ambos passaram fora do sandbox.
As sondagens HTTP exigiram servidor e cliente no mesmo contexto de execução;
o runner resolve essa separação sem alterar configuração do produto.

As suítes SQL usam PostgreSQL em memória (PGlite). Auth, Storage e pg_cron
são representados por fixtures; não comprovam entrega de e-mail, agendamento
cron real ou autenticação pelo serviço remoto. Cobrem onboarding confirmado,
trial único de sete dias, planos/vagas, agenda, snapshots, sobreposição,
reserva pública, cancelamento/reagendamento, roles, IDOR e RLS de avaliações.
Os testes das Edge Functions executam os entrypoints reais em VM sem fetch
de rede, com Stripe/Supabase substituídos por mocks.

## Supabase remoto: somente leitura

Projeto Agendê: `wohimauqgywshbbejjcl`. O
[snapshot de 08/10](migrations/remote-audit-2026-10-08.json) veio de SELECTs
do histórico e catálogo, não de aplicação de migrations.

| Drift | Constatação | Próximo passo |
| --- | --- | --- |
| 20260919201138_hardening_snapshot_owner_timezone | Remota; SQL ausente no Git e `statements=[]` no histórico | Recuperar SQL original em backup/artefato do autor; não inventar migration histórica |
| 20260927014947_launch_readiness_reviews | Local, ainda ausente no remoto | Aprovação e rollout separado do banco, com verificação posterior |

São 63 versões locais e 63 remotas, mas os conjuntos diferem nesses dois itens.
A mesma contagem não comprova reconciliação. O remoto também conserva três
entradas de public_booking com o comentário `-- applied via execute_sql`,
não o SQL original; os arquivos completos existentes no Git foram preservados.
O remoto possui `app.enforce_active_owner`, `app.lock_workspace_membership` e
o trigger de owner que não estão reproduzidos com esses nomes no replay local.
Assim, o sucesso do replay local não comprova equivalência integral ao remoto.

Confirmada ausência de `public.appointment_reviews`,
`public.submit_appointment_review(uuid,integer,text)` e
`public.list_my_reschedule_slots(uuid,uuid,date)`. O read model remoto anterior
não entrega os IDs necessários à interface de reagendamento; a UI já esconde
essa ação se faltarem IDs. Avaliações e reagendamento completo pelo cliente
dependem da migration pendente. A correção deste PR evita o crash das páginas;
ela não habilita esses recursos no banco remoto.

RLS habilitada em todas as tabelas de public/app. Nenhuma função SECURITY DEFINER
nesses schemas sem search_path configurado. Os getters de segredos Stripe,
acquire_stripe_checkout, bind_stripe_checkout e sync_billing_subscription
não têm EXECUTE para anon/authenticated. Nenhum segredo foi lido.

Advisors: 5 RPCs SECURITY DEFINER executáveis anon, 53 authenticated. São
interfaces públicas/autenticadas intencionais, cuja autorização interna precisa
de testes; a presença desses avisos não autoriza revogar indiscriminadamente
RPCs de reserva e convites. O lease privado de checkout tem RLS sem policy,
intencionalmente server-only. Continua desabilitada a
[proteção de senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Nenhuma configuração Auth/RLS/grant foi alterada remotamente.

## Stripe: leitura LIVE e testes locais

Única conta conectada: `acct_1UH3D6Kii3CCJXtc`, LIVE. Leitura confirmou seis
preços ativos BRL: Solo 89,90/mês e 799/ano; Equipe 169,90/mês e 1.499/ano;
Salão 299,90/mês e 2.799/ano, com interval_count=1 e usage_type=licensed.
Webhook habilitado aponta para o projeto correto, API 2026-08-26.dahlia,
inscrito em checkout completed/async success/async failed, subscription
created/updated/deleted e invoice paid/payment_failed.

Leitura dos fontes das duas Edge Functions ACTIVE v2 confirmou igualdade
integral com os arquivos no repositório. Os hashes estão no
[registro de conferência](migrations/edge-audit-2026-10-08.json).

Mocks e SQL local validam seleção dos seis planos, limite de vagas, lease,
idempotência, preservação do trial, assinatura de webhook, replay e estado
atual, falha/recuperação/cancelamento. Nenhum customer, sessão Checkout,
assinatura ou pagamento real foi criado. Portal e entrega externa de webhook
não foram comprovados nesta auditoria. paused/resumed não constam dos eventos
do endpoint LIVE e não devem ser anunciados como fluxo externo validado.

## Bloqueios antes de liberar o lançamento

1. Aprovar e verificar o rollout da migration de avaliações/reagendamento;
   confirmar schema, grants/RLS, read model e jornadas após a aplicação.
2. Recuperar o SQL histórico perdido e comparar schema local/remoto, incluindo
   o guard de último owner. Não executar repair/reaplicação por suposição.
3. Validar jornadas autenticadas em ambiente isolado com inbox/fixtures:
   cadastro, confirmação, login/logout, recuperação de senha, onboarding,
   trial, agenda e reserva pública pelo navegador. Nenhuma conta de teste
   remota foi criada nesta sessão.
4. Disponibilizar sandbox Stripe isolado e exercer Checkout, Portal, primeira
   fatura, renovação, falha/recuperação, cancelamento e entrega/replay de webhook.
5. Tratar os 9 avisos high da cadeia braces (glob em tooling shadcn/ESLint).
   A dependência shadcn também fornece CSS de build; não foi removida nem
   submetida ao downgrade incompatível sugerido pelo audit. A exposição em
   produção deve ser avaliada separadamente; não se afirma risco zero.
6. Revisar configuração de senhas vazadas e redirects Auth no ambiente alvo.

Sem merge, deploy manual, migrations/DDL/repair remotos, alterações de produção
ou pagamentos reais. O PR entrega código e evidências; lançamento não liberado
automaticamente pelos checks locais.
