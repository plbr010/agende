# Agendê — auditoria técnica final de 10/10/2026

**Conclusão:** código preparado e verificado em isolamento; produção ainda
não pode ser declarada pronta para clientes pagantes. Nenhuma configuração,
migration, dado de produção ou cobrança real foi alterado nesta missão.

## 1. Commit e branch auditados

- Main atualizada: `54be3eb98474acfb4120c06423c621f916cca10e`, com PRs #18/#20.
- Produção Vercel também serve esse commit.
- Branch exclusiva: `codex/launch-audit-2026-10-10`.
- Integração inicial: `b263331c25b2b4e3f817fa9b694ac47059bc37eb`.
- PR #19 ainda aberto: suas correções foram incorporadas por merge nesta
  branch, sem modificar a branch anterior nem a do Cursor. O novo PR é uma
  continuação consolidada do #19, não uma segunda implementação independente.
- Árvore inicial limpa; mudanças de onboarding, textos, acessibilidade,
  calendário e reserva dos PRs #18/#20 preservadas. Nenhum TSX de UX foi editado.

## 2. Problemas encontrados e prioridade

| Classe | Problema confirmado | Evidência/estado |
| --- | --- | --- |
| P0 | Avaliações e slots de reagendamento ausentes no remoto | to_regclass/to_regprocedure retornam null; versões pendentes |
| P0 | Origem de Auth podia virar localhost em produção | Vercel não tem NEXT_PUBLIC_SITE_URL; teste antes da correção retornou localhost |
| P0 | Billing pode reter estado antigo após downgrade com excesso de assentos | Falha SQL reproduzida no #19; correção ainda não aplicada em produção |
| P0 | Preview/development não são isolamento para testes de escrita | URL/key configuradas para production, preview e development apontam ao mesmo Supabase de produção |
| P0 | Ciclo de cobrança externa ainda sem evidência de teste real | Somente conta Stripe LIVE disponível; nenhuma sandbox conectada |
| P1 | Save de serviço podia persistir parcialmente | Service insert sucede e falha de vínculo deixa serviço criado; regressão falhou antes do fix |
| P1 | Auth/SMTP e sessão real no navegador não comprovados | Sem staging/GoTrue/inbox isolado; mocks e fixtures SQL não provam entrega de e-mail |
| P1 | Histórico de migrations incompleto | Uma versão statements vazio e três comentários-placeholder; nenhum repair realizado |
| P1 | Proteção de senhas vazadas desabilitada | Advisor atual confirma; nenhuma configuração Auth alterada |
| P2 | Cinco alertas high no tooling de lint | Produção zero alertas; sem downgrade incompatível do Next/ESLint |
| P2 | Domínio próprio citado antes não está operacional | agendeapp.online retornou NXDOMAIN no resolver e não consta no projeto; lançamento nesse domínio não foi presumido |

Os níveis classificam a consequência operacional. Correções preparadas em
branch não eliminam um bloqueio de produção antes da revisão/liberação.

## 3. Correções implementadas

**Origem de Auth:** `getSiteUrl` agora prioriza configuração explícita válida;
em produção usa VERCEL_PROJECT_PRODUCTION_URL ou VERCEL_URL, e preview usa
VERCEL_URL. Localhost só é fallback local. Credenciais embutidas, protocolos
inadequados, path/query/hash ou origem ausente em deploy são rejeitados com
erro genérico. Nenhum Host/Origin arbitrário define o destino de e-mails.
O comportamento usa [variáveis de sistema documentadas da Vercel](https://vercel.com/docs/environment-variables/system-environment-variables).

**Catálogo atômico:** `saveServiceAction` passa a uma RPC única,
`save_service_with_professionals`. A nova migration valida owner/admin,
confirmação, entitlement, IDs/tenant e profissionais ativos antes do save.
Um erro posterior também reverte serviço e vínculos. Overrides existentes
continuam intactos. A action não faz fallback para writes parciais quando
a RPC não está aplicada. Essa dependência está no runbook de liberação.

**Integração local:** adicionadas regressões de origem, action atômica,
isolamento/roles e rollback real de erro depois do insert. Uma nova suíte
executa os módulos reais das server actions contra SQL real em memória,
usando adapter Supabase e contexto Auth simulados. Preserva o redirect de
setup do Cursor e confirma persistência, respostas e parsers de negócio.

**Continuidade do #19:** mantidas as correções de sessão/logout/cadastro,
guards de membership, billing com excesso de assentos e remoção do CLI shadcn
com CSS/licença preservados. Next.js/eslint-config-next continuam 16.3.8.
Não houve alteração adicional de dependências nesta missão.

## 4. Testes executados e evidências

Node 24.19.0; PGlite 0.5.8/PG18.3 em memória; remoto PG17.6. Build local
com URL/key sintéticas. Nenhum usuário ou objeto financeiro remoto foi criado.

| Comando/verificação | Resultado | Limite da evidência |
| --- | --- | --- |
| npm ci | Passou, 394 pacotes | Lockfile integrado |
| npm run lint | Passou | Verificação estática |
| npm run typecheck | Passou | Next typegen/tsc |
| npm test | 209 passaram, zero fail/skip | Inclui testes do Cursor e regressões técnicas |
| npm run build | Passou | Next 16.3.8, ambiente sintético |
| npm run test:smoke | 32 sondagens passaram | HTTP local do build, anônimo |
| Produção: audit-preview.mjs | 32 sondagens passaram | Somente GET, sem formulário/cookie de usuário |
| verify-stripe-recovery.mjs | Passou | Fonte/histórico recuperado offline, não teste Stripe externo |
| audit-local-flows.mjs | Cinco suítes passaram | SQL foundation/catalog/settings/agenda/public booking |
| audit-schema-drift.mjs | Executado e resultado salvo | Comparação offline com catálogo remoto rechecado |
| atomic-service-sql.test.mjs | Dois testes passaram | Tenant/owner/admin/professional/receptionist/anon, overrides e rollback |
| action-sql-integration.test.mjs | Nove resultados passaram | Actions reais, transporte/contexto Auth simulados e SQL real local |
| npm audit --omit=dev | Zero vulnerabilidades | Consulta atual do registry npm |

17 novos resultados foram adicionados hoje: três de origem, três de action
de serviço, dois de SQL atômico e nove na jornada integrada (incluindo o
teste que contém os subtestes). Eles não representam 17 serviços externos.
Falhas iniciais dos adapters/fixtures (alias SQL, serialização de RPC e
janela financeira) foram corrigidas nos testes, sem atribuí-las ao produto.

### Matriz das 12 funcionalidades críticas

| Funcionalidade | Evidência em isolamento | Serviço/staging real de teste |
| --- | --- | --- |
| Criar estabelecimento | createWorkspaceAction → RPC/SQL; trial e redirect setup | Não disponível |
| Configurar serviços | saveServiceAction → RPC atômica; preço e vínculos persistidos | RPC ainda ausente no remoto |
| Cadastrar/configurar profissionais | Profile action persiste; SQL de invites/roles/assentos na suíte foundation/settings | Convite/e-mail real não testado |
| Definir disponibilidade | addWorkingHourAction → insert sob RLS; catálogo/slots reconhecem o período | Não disponível |
| Receber agendamentos | Action pública → SQL → parser de confirmação | Não disponível |
| Impedir conflitos | Segunda reserva no mesmo slot rejeitada; constraints/exclusion SQL | Não é teste de carga multi-conexão |
| Reagendar | Action → slots/SQL → loader; mesmo appointment ID | Slots RPC ausente em produção |
| Cancelar | IDOR negado e cliente cancela segundo appointment | Não disponível |
| Registrar pagamentos | Action financeiro marca paid e mantém idempotência | Pagamento é registro contábil local, não cobrança Stripe |
| Consultar financeiro | RPC reflete pagamento no período correto | Não disponível |
| Estoque/pacotes | Actions criam/movimentam/vendem; read models conferidos | Não disponível |
| Receber avaliações | Action/SQL/read model; única e imutável, apenas concluído | Tabela/RPC ausentes em produção |

O adapter usa queries/RPCs reais do SQL local e form inputs usados pelas
actions, mas não executa React no navegador, PostgREST, GoTrue, SMTP ou Stripe.
Auth/sessão, cache Next e transporte estão substituídos. A infraestrutura
de mock não fornece rede. Perfil profissional configurado não prova entrega
de convite externo. PGlite PG18 não substitui staging PG17 ou teste de corrida
com conexões independentes. Nenhuma jornada autenticada real foi anunciada
como aprovada.

## 5. Estado do Supabase

Projeto `wohimauqgywshbbejjcl` ACTIVE_HEALTHY. Leitura em 10/10/2026, cerca de
20:22 BRT. As versões/hashes do histórico e os oito grupos de catálogo
coincidem com o snapshot completo anterior: tables, policies, grants,
functions, triggers, columns, constraints e indexes.

- 63 migrations remotas; 67 arquivos locais = 62 compartilhadas + cinco pendentes.
- Tabela/RPC de avaliações e slots RPC ainda null. Nova RPC atômica também
  não existe no remoto, sem colisão de nome.
- 31 tabelas públicas com RLS/FORCE; uma privada de leases com RLS e acesso
  privilegiado, sem policy de usuário. Nenhuma view pública no snapshot.
- 53 policies, 224 funções, 82 triggers, 306 colunas, 237 constraints e
  173 índices no escopo consultado. Nenhuma definição mudou desde 09/10.
- SECURITY DEFINER app/public com search_path vazio. Advisors: cinco RPCs
  anônimas e 53 autenticadas para revisão de autorização, não revogação cega.
- Isolamento e IDOR exercidos em SQL; grants anon/authenticated conferidos.
- `20260919201138` continua statements vazio. `20260918203839/40/41` têm
  apenas comentário de aplicação via execute_sql. Nada foi inventado/repairado.
- As diferenças de service_role da fixture versus defaults da plataforma
  permanecem explicitamente separadas na comparação offline.

Preflight, ordem e validação estão no
[runbook atualizado](migrations/launch-rollout-2026-10-10.md). As cinco
migrations aguardam aprovação, staging PG17 e executor apropriado; não usar
db push/repair genérico enquanto o histórico divergente não tiver procedimento
específico revisado.

## 6. Estado do Stripe

Descoberta atual: somente `acct_1UH3D6Kii3CCJXtc`, LIVE. Não foi usado como
ambiente de teste nem foi chamada API financeira LIVE. Nenhum Checkout,
customer, pagamento, assinatura ou evento real foi criado.

As oito suítes Edge usam payloads e SDK Stripe mockados. Elas cobrem os seis
lookup keys Solo/Equipe/Salão mensal/anual, preços fixos, trial original,
duplicação/lease, Portal de gestores, plano vindo do preço, renovação, canceled,
past_due, assinatura inválida, replay/retry e falha assíncrona sem ativação.
SQL local valida bindings, estados/entitlement, assentos e event_id único.

Leitura Supabase atual confirmou stripe-billing/webhook ACTIVE v2 e hashes
iguais ao Git. Billing verify_jwt=true; webhook false e HMAC próprio.
Isso prova fonte/config de entrada, não entrega externa. Configuração atual
de webhook/Portal Stripe, cartões recusados, Test Clocks e renovação externa
não foram validados em sandbox, porque esse ambiente não está conectado.

Para fechar o gate: sandbox com seis preços/lookup keys, Portal permitido,
webhook TEST e segredos próprios; executar as jornadas com cartões de teste
e Test Clocks. Não reutilizar a chave LIVE. Política fiscal/Stripe Tax não
foi alterada ou validada nesta missão.

## 7. Estado da Vercel

Projeto `prj_NLQEGsBiUWcKjws9vjIKFgXOvgfx`, framework Next.js, Node 24.x.
Deployment de produção `dpl_DQDkSHHHcZopha484SeMUkdMYvaX` READY, origem Git,
commit `54be3eb`, região iad1. Os dois deployments de produção anteriores
consultados também estavam READY. Nenhum deploy manual foi executado.

`agende-lac.vercel.app` está verificado e respondeu às 32 sondagens anônimas.
Há aliases automáticos de main/projeto. Não há domínio próprio configurado.
`agendeapp.online` não resolveu no DNS consultado; necessidade desse nome não
foi presumida como requisito obrigatório de lançamento.

Variáveis customizadas enumeradas, sem valores sensíveis: apenas
NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Ambas valem
para production/preview/development; a URL pública aponta ao Supabase de
produção. NEXT_PUBLIC_SITE_URL não existe. A nova resolução corrige o
fallback localhost, mas ainda exige liberação e validação do link recebido.
Autoexposição das variáveis de sistema e allowlist real de Auth devem ser
confirmadas; o conector não expôs configuração privada de Auth/SMTP.

Logs: janela de 24h rejeitada pela retenção Hobby; consulta de error/fatal
por requestPath nos últimos 30 minutos retornou zero grupos. Isso não prova
ausência de erros fora da janela nem jornadas sem tráfego. Logs Supabase
agregados mostraram pgbouncer/postgres, sem evidência de Auth/Stripe delivery;
o campo de severity não forneceu sinal útil, portanto não se afirma zero
erros Supabase. Não foram coletados corpos de requisição ou dados pessoais.

## 8. Bloqueios P0/P1 restantes

- **P0:** aplicar/validar o lote de cinco migrations sob aprovação; o código
  de cadastro de serviço depende da quinta RPC. Banco antes da liberação do app.
- **P0:** liberar as correções de Auth/billing após revisão; elas ainda não
  são o código de produção observado. Confirmar origem/callbacks reais.
- **P0:** isolamento para jornadas de escrita e Stripe TEST. Previews atuais
  não são staging; não criar contas/testes neles com a configuração atual.
- **P1:** comprovar e-mails, cookies/sessão e jornadas autenticadas no navegador.
- **P1:** procedimento de recuperação do histórico vazio/placeholder e operação
  de migrations sem repair por suposição; staging PG17 e teste concorrente.
- **P1:** avaliar/habilitar proteção de senhas vazadas, mediante aprovação.
- **P2:** tooling de lint com cinco high e domínio próprio/observabilidade longa,
  se esses recursos forem desejados. Não foram trocadas versões por suposição.

## 9. Operações que exigem autorização

Merge/liberação da aplicação; lote SQL e registro correto de versões em
produção; mudanças em URLs/keys por ambiente, Auth/SMTP/callbacks, configurações
LIVE de Stripe, DNS/domínio ou secrets. Qualquer repair histórico exige
fonte comprovada e aprovação específica. Nenhuma dessas operações foi realizada.

## 10. PR e evidências

Novo PR da branch `codex/launch-audit-2026-10-10` será publicado após os commits.
Inclui as correções anteriores do #19, mantendo esse PR/branch intactos.
Revisar a entrega consolidada; não contar o #19 como trabalho independente
já aplicado à main. Não foi feito merge automático.

Evidências persistidas:

- `deployment-audit-2026-10-10.json`: deployments/domínio/metadata env/logs/GETs.
- `migrations/remote-recheck-2026-10-10.json`: confirmação de catálogo/histórico
  inalterados e referência SHA-256 ao snapshot completo de 09/10.
- `migrations/edge-recheck-2026-10-10.json`: hashes e versões Edge atuais.
- `migrations/drift-final-2026-10-10.json`: target/baseline reproduzíveis offline.
- `migrations/launch-rollout-2026-10-10.md`: lote e ordem de liberação.
- Fontes dos testes e CI versionados no PR.

## 11. Percentual estimado de prontidão

**50% como índice conservador de dez gates de liberação**, com pesos iguais.
Não é percentual de funcionalidades, cobertura de código, probabilidade de
sucesso ou autorização para vender. Cinco gates têm evidência nesta missão:
sincronização/preservação, qualidade estática/build/dependências, integração
local, RLS/segurança SQL e disponibilidade HTTP anônima do deployment atual.

Cinco gates continuam abertos: rollout do banco, liberação do app corrigido,
Auth/SMTP/sessão real, ciclo Stripe TEST externo e configuração/isolamento dos
ambientes/callbacks. Gates P0 são obrigatórios independentemente do percentual.
O lançamento de 15/10/2026 não está tecnicamente liberado enquanto estiverem
abertos. Mocks e SQL local reduzem risco; não fecham esses gates externos.
