# Agendê — finalização técnica para 15/10/2026

Data: 09/10/2026, America/Sao_Paulo. Branch: `codex/launch-final-hardening`.
Base: main `8cfadec`, incluindo PRs #15, #16 e #17. A árvore inicial estava
limpa; a branch anterior e as alterações do Cursor foram preservadas.

**Conclusão: correções verificadas em isolamento e prontas para revisão;
lançamento com cobrança ainda bloqueado por rollout e validação externa.**
Nenhuma migration, DDL, repair, configuração Auth ou dado de produção foi
alterado. Não houve cobrança, Checkout, assinatura ou evento Stripe real.

## 1. Problemas encontrados

1. Produção continua sem tabela/RPC de avaliações e RPC de slots para
   reagendamento; as duas migrations de lançamento não foram aplicadas.
2. Git não reproduzia o lock de membership, o trigger de último owner e cinco
   corpos de funções endurecidos presentes no catálogo remoto.
3. Sincronização financeira rejeitava `canceled`/`past_due` se o preço recebido
   tivesse menos assentos que os usados. Reproduzido em SQL antes da correção:
   `plan_seat_limit_exceeded`, mantendo o estado anterior da assinatura.
4. Falhas nas consultas de sessão eram confundidas com ausência de perfil,
   workspace ou assinatura. Isso podia enviar usuários existentes ao onboarding.
5. Logout ignorava erro do Auth e redirecionava como se tivesse encerrado a
   sessão. Cadastro classificava qualquer HTTP 422 como conta duplicada.
6. Dependência de CLI shadcn trazia a cadeia vulnerável braces para a instalação
   da aplicação, embora somente seu CSS fosse usado pelo código.
7. Não há staging Supabase conectado, Docker instalado ou Stripe TEST/sandbox
   conectado. Entrega de e-mail e ciclo financeiro externo permanecem sem prova.
8. Histórico remoto contém uma versão vazia e três placeholders de SQL.
   Comparar o catálogo atual não recupera esse histórico.

## 2. Problemas corrigidos

- Nova migration `20261009172028_launch_observed_owner_guard.sql`: leva os
  guards observados ao Git sem fabricar a migration histórica ausente.
  Mantém definições remotas conhecidas e recusa definições inesperadas.
- Nova migration `20261009173042_billing_reconcile_excess_seats.sql`:
  canceled/past_due/expired são reconciliados sem bloqueio por assentos.
  Active/trialing incompatível vira expired, bloqueando acesso operacional
  em vez de manter a autorização antiga. Conta assentos após obter o lock de
  subscriptions usado também pela gestão de membros. Não remove profissionais,
  não altera datas de trial e não muda assinatura/preços no Stripe.
- Loader de sessão propaga erro público e genérico em falhas de perfil,
  membership e assinatura; não converte indisponibilidade em onboarding.
- Logout não redireciona em erro. Cadastro reconhece conta duplicada apenas
  pelo código/mensagem correspondente, não por todo status 422.
- CLI shadcn removido; o CSS de shadcn 4.21.4 foi copiado exatamente, sem
  alterações de seletores, com licença MIT. SHA-256 da cópia:
  `4c371f7a1ff5d219ae2f7ff28bd256b4346fd546fe46fbae22092e57db2f0fae`.
  A aparência e o trabalho de UX do Cursor foram preservados.
- 15 novos testes: sete Auth, cinco SQL de hardening/rollout e três de Edge
  Stripe. Verificador histórico aceita apenas as quatro migrations revisadas
  ainda locais. Novo comparador de schema funciona exclusivamente offline.

## 3. Testes executados e resultados

Ambiente: Node 24.19.0; Next.js/eslint-config-next 16.3.8 preservados.
PostgreSQL local: PGlite 0.5.8, engine 18.3; remoto: PostgreSQL 17.6.
Build e HTTP usaram URL/key Supabase sintéticas. Nenhuma credencial de produção
foi usada nos testes. Fixtures de usuários SQL existem só em memória.

| Verificação | Resultado | Ambiente/evidência |
| --- | --- | --- |
| npm ci | Passou | Lockfile final, 394 pacotes instalados |
| npm run lint | Passou | ESLint local |
| npm run typecheck | Passou | next typegen e tsc |
| npm test | 176 passaram, sem falhas/skips | Mocks, SQL local e módulos reais isolados |
| npm run build | Passou | Next.js 16.3.8, configuração sintética |
| Testes após build | 176 passaram | Inclui as 15 regressões novas |
| npm run test:smoke | 32 sondagens passaram | Servidor local do build, GET anônimo |
| audit-local-flows.mjs | Cinco suítes passaram | foundation, catalog, workspace_settings, agenda, public_booking |
| verify-stripe-recovery.mjs | Passou | Evidência histórica offline de 27/09, não leitura atual de pagamentos |
| audit-schema-drift.mjs | Comparação gerada | Snapshot remoto somente leitura versus baseline/target locais |
| Dry-run das quatro migrations | Passou | SQL local sobre as definições de membership observadas |
| Reaplicação das novas migrations | Passou | Idempotência local |
| Definição inesperada no owner guard | Recusada, rollback confirmado | Transação SQL local |
| npm audit --omit=dev | Zero alertas | Consulta real ao registro npm |
| npm audit completo | Cinco high | Cadeia dev de eslint-config-next/fast-glob/micromatch/braces |

A falha financeira foi observada antes da correção e o mesmo teste passou
depois. Dois testes de confirmação inicialmente falharam por uma fixture
sem NextURL.clone; a fixture foi corrigida e a execução final passou.
Nenhuma falha conhecida desses checks foi deixada aberta.

### Matriz de fluxos: o que foi realmente validado

| Fluxo | Mock/módulo real isolado | SQL local | Staging/serviço real de teste |
| --- | --- | --- | --- |
| Cadastro cliente/profissional | Inputs, intenção, seleção de plano, callback e erros | Auth trigger cria perfis com usuários fixtures | Não disponível |
| Confirmação de e-mail | PKCE/OTP, token expirado, tipos aceitos e redirects | Exigência de e-mail confirmado nas RPCs | Entrega de e-mail não testada |
| Recuperação de senha | Envio, PKCE/OTP, expiração, troca e sign-out | Sem servidor Auth local | Entrega/link real não testados |
| Login/logout | Credenciais, confirmação, next seguro, sucesso/erro de logout | Sem servidor Auth local | Sessão real no navegador não testada |
| Trial | Apresentação/inputs | Único de sete dias, segundo workspace sem trial, troca preserva datas, limite exato e vencimento | Não disponível |
| Roles/tenant/IDOR | Guards de menu, páginas e actions | Owner/admin/professional/receptionist, outra conta, outros salões, grants e RLS | Não disponível |
| Avaliações/reagendamento | Indisponibilidade do schema, forms/contratos | Avaliação única, somente concluído, IDOR, snapshots de duração, timezone | Objetos ausentes em produção |
| Checkout seis preços | Edge real com Stripe/Supabase mockados, valores e redirects | Lease, bindings, trial e permissões | Não disponível |
| Mensal/anual e renovação | Seis lookup keys, período atual e metadata antiga | Reconciliação de plano/status/período | Não disponível |
| Upgrade/downgrade | Seleção/assentos e evento de plano | Limites, downgrade com excesso bloqueado, restauração de plano compatível | Portal real não testado |
| Portal/cancelamento | Só gestores com customer; redirects seguros | canceled bloqueia mesmo após downgrade | Não disponível |
| Pagamento recusado | Evento async failed não ativa; invoice failed usa estado atual | past_due bloqueia acesso | Cartão de teste/dunning não exercidos |
| Webhooks/replay | HMAC inválido/expirado, replay, retry após erro de sync, pause/resume | Unique event_id, uma linha após replay, service_role aceito e authenticated negado | Entrega externa não exercida |

Os testes de webhook fornecem payloads simulados e HMAC de segredo mock.
Não são eventos emitidos pelo Stripe. PGlite não fornece Auth, SMTP, PostgREST
nem múltiplas conexões para uma prova de corrida sob carga; é necessária
validação complementar de concorrência e integração em staging PG17.
As sondagens HTTP não exercem jornadas autenticadas pelo navegador.

## 4. Estado atual do Supabase

Projeto `wohimauqgywshbbejjcl`, ACTIVE_HEALTHY, região us-east-2. Snapshot do
catálogo em 09/10/2026, cerca de 14:18 BRT, somente leitura.

- 63 migrations remotas; 66 arquivos Git = 62 versões compartilhadas + quatro
  pendentes. Uma versão remota vazia não tem arquivo Git.
- `20260919201138`: statements vazio, sem reconstrução ou repair.
- `20260918203839`, `20260918203840`, `20260918203841`: histórico registra
  somente `-- applied via execute_sql`; objetos atuais estão no catálogo.
- Entre outras 59 versões: 34 hashes coincidem após normalizar CRLF; 18 têm
  apenas diferenças iniciais de comentários/fim de arquivo; sete diferem no
  texto e foram inspecionadas. Não se afirma igualdade integral do histórico.
- Baseline: colunas, RLS, policies, índices e constraints existentes coincidem;
  diferença de constraint/trigger de último owner e corpos/locks documentada.
- Target: só diferenças intencionais de avaliações/read model e billing.
  Guards de membership passam a coincidir com o catálogo remoto.
- Todas as 31 tabelas públicas têm RLS e FORCE RLS. A tabela privada de leases
  tem RLS e nenhum acesso de usuário; ausência de policy é intencional.
- Nenhuma view pública; anon lê apenas plans. App é inacessível para anon.
- Todos os SECURITY DEFINER de app/public têm search_path vazio. Warnings do
  advisor listam cinco RPCs anônimas e 53 autenticadas; isso exige revisão de
  autorização do corpo, não remoção automática das RPCs do produto.
- Diferenças de 215 grants de tabela e 32 EXECUTEs service_role são registradas
  separadamente: a fixture local não replica os defaults privilegiados da
  plataforma. Grants de anon/authenticated coincidem na baseline.
- Proteção de senhas vazadas continua desabilitada no advisor. Não foi alterada.

O [runbook](migrations/launch-final-rollout-2026-10-09.md) contém pré-condições,
dependências, ordem, fingerprints, abortos e consultas pós-rollout.
As práticas de search_path/grants seguem a [documentação de funções](https://supabase.com/docs/guides/database/functions).
Avisos de Auth: [proteção de senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## 5. Estado atual do Stripe

A descoberta de contas retornou somente `acct_1UH3D6Kii3CCJXtc`, LIVE.
Nenhuma chamada financeira foi realizada nessa conta durante esta missão.
Preços, Portal e configuração atual de webhook LIVE não foram revalidados;
a evidência de 08/10 não foi promovida a validação atual ou de sandbox.

Por leitura do Supabase, stripe-billing e stripe-webhook estão ACTIVE v2, com
fontes idênticos ao Git. verify_jwt é true no billing e false no webhook,
que valida assinatura própria. Os SHA-256 estão em edge-final-2026-10-09.json.

As oito suítes Edge Stripe usam mocks. A integração SQL usa fixtures locais,
inclusive chamadas com role service_role. Sandbox precisa conter os seis
lookup keys e preços esperados, Portal com produtos permitidos, endpoint de
webhook test e segredos próprios. Não copiar chaves LIVE para staging/CI;
usar cofre de segredos e chave restrita por ambiente.

Política fiscal/Stripe Tax não foi configurada nem validada. Antes de liberar
cobrança, o responsável precisa definir o tratamento fiscal aplicável; não
foi habilitado automatic_tax por suposição nesta missão.

## 6. Bloqueios para o lançamento

1. Aprovar e validar as quatro migrations em staging PG17 e depois produção.
   Hoje avaliações e slots de reagendamento ainda não existem no remoto.
2. Validar Auth/SMTP em ambiente isolado: cadastro dos dois perfis, confirmação,
   senha, login/logout, sessão/cookies e navegação pelo navegador.
3. Exercitar Stripe TEST: Checkout seis preços, Portal, troca/cancelamento,
   renovação com Test Clock, cartão recusado, entrega/replay de webhook.
4. Resolver procedimento de histórico perdido/placeholder, sem repair por
   suposição. Não considerar db push genérico seguro.
5. Revisar configuração operacional: domínio/redirects Auth, SMTP e proteção
   de senhas vazadas, Portal/webhook e tratamento fiscal. Configurações reais
   não foram alteradas nem integralmente inspecionadas nesta missão.
6. Cinco alertas high permanecem apenas no tooling de lint; braces 3.0.3 e
   micromatch 4.0.8 eram as últimas versões consultadas. Audit sugere downgrade
   incompatível de eslint-config-next para 14.2.35, que não foi aplicado.
   [Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

## 7. Operações que exigem aprovação

- Aplicação do lote SQL e registro correto de versões em produção.
- Qualquer alteração de Auth/SMTP, redirects, senhas vazadas, segredos,
  Portal/webhooks LIVE, domínio ou configuração de produção.
- Qualquer repair/reconstrução de histórico: somente com fonte comprovada e
  procedimento específico aprovado; não está proposto um repair automático.
- Merge e liberação de produção permanecem sob controle humano.

A solicitação de acesso a staging/sandbox foi apresentada nesta conversa.
Sem esse acesso, os testes externos estão explicitamente pendentes; não foi
usado o ambiente LIVE como substituto.

## 8. PR e evidências

PR da branch `codex/launch-final-hardening` para main: link será inserido após
a publicação. Sem merge automático.

- `docs/migrations/remote-final-2026-10-09.json`: catálogo/histórico por leitura.
- `docs/migrations/drift-final-2026-10-09.json`: comparação offline reproduzível.
- `docs/migrations/security-final-2026-10-09.json`: resumo dos advisors/grants.
- `docs/migrations/edge-final-2026-10-09.json`: versões e hashes Edge remotos.
- `docs/migrations/dependencies-final-2026-10-09.json`: audits e hash CSS.
- `supabase/checks/launch-final-preflight.sql`: somente leitura para operador.

## 9. Estimativa fundamentada de prontidão

Dois de seis gates têm evidência suficiente nesta missão: checks do código/build
e segurança/entitlements em SQL local. Quatro ainda estão abertos: rollout
staging/produção, Auth/e-mail real de teste, ciclo Stripe sandbox e configuração
operacional. Essa contagem não é percentual de funcionalidades nem previsão
de ausência de bugs. **O sistema ainda não está liberado para clientes pagantes.**

Planejamento condicional após acesso/autorizações: 0,5–1 dia para rollout e
verificação em staging PG17; 0,5–1 dia para Auth/SMTP e jornadas; 1–2 dias para
Stripe/Test Clocks/webhooks, revisão e liberação controlada. Faixa de 2–4 dias
úteis de engenharia se não surgir outra falha. O prazo de 15/10 depende de
esses gates serem fechados; sem acesso e aprovação não há data garantida.
