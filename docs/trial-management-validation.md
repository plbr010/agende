> Registro histórico da implementação anterior ao rebase. O resultado atualizado
> da recuperação e integração está em [trial-management-rebase-validation.md](trial-management-rebase-validation.md).
# Trial e gestão — validação local

Base: `70749924d4e3d3f30481ed4d32c12e8eb4d740f7`, após fetch e fast-forward de main.
Branch nova: `codex/trial-management-ux`. Nenhum merge realizado.

## Entregas

- Nova migration `20260925201418_trial_selected_plan.sql`: plano selecionado,
  teste único de 168 horas, troca durante teste sem alterar datas, bloqueio de
  downgrade acima da capacidade e preços anuais. Preserva claims, RLS e guards.
- Onboarding com Solo/Equipe/Salão, destaque Equipe, preços e aviso dos 7 dias.
- Assinatura mostra situação, prazo, equipe, limite e troca de plano durante teste.
- Estoque: criação, edição, entrada, saída, ajuste, arquivo, reativação, busca,
  filtros, histórico e estados vazios usando funções existentes.
- Pacotes: criação com serviços/sessões, venda para cliente e cancelamento
  validado pela função existente; exibição de uso, validade e situação.
- Financeiro: receitas/despesas, baixa, cancelamento, reabertura e devolução
  com confirmação, motivo e idempotência. Nenhuma transferência de dinheiro.
- Relatórios e financeiro compartilham períodos inclusivos no fuso do negócio.
- Tipos de 31 tabelas, 56 funções públicas e 16 enums gerados das migrations
  locais, incluindo relacionamentos e campos anuais/de cobrança.
- Fontes existentes Manrope e Cormorant Garamond servidas localmente com OFL;
  o build não depende mais de baixar Google Fonts.

## Verificação

| Comando | Resultado final |
| --- | --- |
| `npm test` | exit 0; 111 testes, 111 pass, 0 fail, 0 skipped |
| `npm run lint` | exit 0; sem erros ou warnings do ESLint |
| `npm run typecheck` | exit 0; tipos de rotas gerados; TypeScript sem erros |
| `npm run build` | exit 0; compilação e geração de 30/30 páginas concluídas |
| `git diff --check` | exit 0; sem erros de whitespace |

Node 24.19.0 (requisito do projeto: >=22). O processo npm foi executado pelo
runtime Node 24, pois o Node global do Windows era 20.17.0.
O usuário restrito do Windows causava `uv_os_get_passwd ENOMEM` em `os.userInfo`,
antes de carregar tsx. Para executar as verificações, um preload **fora do
repositório** forneceu username/homedir das variáveis de ambiente apenas quando
essa consulta falhava. Nenhuma regra da aplicação ou teste foi substituída.
O primeiro build não conseguiu baixar Google Fonts na rede restrita; a versão
final usa os mesmos arquivos WOFF2 que já estavam no cache de build local.

`npm test` inclui `scripts/database.test.mjs`. O harness `scripts/local-database.mjs`
executa todas as migrations em PostgreSQL WASM (PGlite 0.5.8) em memória, sem URL
nem credenciais remotas. Auth/Storage são estruturas locais da plataforma;
registros de cron são simulados, sem executar o scheduler. Funções, tabelas,
constraints, grants e RLS da aplicação são executados realmente.
Os testes verificam plano inválido, confirmação, primeiro/segundo teste, duração,
troca sem reset, downgrade, owner/admin/professional/receptionist, isolamento,
estoque, pacotes, financeiro, idempotência, devoluções e períodos.
Isso não equivale a um teste concorrente de múltiplas conexões nem a um teste
fim a fim contra Supabase/PostgREST remoto.

Para regenerar os tipos sem conexão remota:

```sh
node scripts/generate-database-types.mjs
```

## Limites e pendências

- Os ZIPs `agende-trial-onboarding-draft-2.zip` e `agende-management-ux-draft.zip`
  não estavam anexados/acessíveis e não foram encontrados nas pastas consultadas.
  A comparação dos drafts continua pendente. Implementação baseada na main e
  nos requisitos textuais; PR em draft até essa revisão.
- Avaliações não receberam implementação de backend. Apenas copy técnica foi
  removida. `integrationPending` continua marcado nessa área.
- Stripe continua desabilitado; não há checkout ou portal simulado.
- A nova migration NÃO foi aplicada remotamente. Onboarding com plano e troca
  de plano dependem da futura aplicação dessa migration, fora deste trabalho.
- As leituras existentes limitam a lista a 100 lançamentos financeiros, 30 vendas
  e 20 movimentos recentes. Busca/filtros locais se aplicam à lista carregada;
  indicadores consolidados continuam vindos das funções de relatório.
- A lacuna histórica descrita em `docs/migrations/recovery-2026-09-23.md` continua
  pendente; a geração representa as migrations versionadas, sem presumir total
  equivalência com o schema remoto desconhecido.
- O ambiente restringiu a escrita durante a tarefa. O trabalho preparado no
  repositório solicitado foi copiado para a pasta desta tarefa, subpasta `agende`,
  onde as mudanças foram concluídas e verificadas. A cópia original foi preservada.

**Nenhuma escrita no Supabase remoto foi realizada.** Não foram executados db
push, db reset, db pull, migration repair ou DDL/DML remoto. Nenhuma migration
antiga foi editada. Nenhum merge será feito neste PR.

## Publicação e arquivos

A tentativa de publicação pelo conector GitHub foi bloqueada: a criação da
árvore Git exige aprovação, mas a política do ambiente é `never`. O Git local
também não conseguiu acessar github.com:443. Portanto, os commits estão somente
locais, não houve push, nenhum PR foi criado e nenhum merge foi feito.
Um bundle Git acompanha a entrega para preservar todos os commits.

Arquivos alterados nesta branch:

- `docs/trial-management-validation.md`
- `package-lock.json`
- `package.json`
- `scripts/database.test.mjs`
- `scripts/generate-database-types.mjs`
- `scripts/local-database.mjs`
- `scripts/run-tests.mjs`
- `src/app/app/avaliacoes/page.tsx`
- `src/app/app/financeiro/page.tsx`
- `src/app/app/pacotes/page.tsx`
- `src/app/app/relatorios/page.tsx`
- `src/app/fonts/OFL.txt`
- `src/app/fonts/cormorant-garamond-latin.woff2`
- `src/app/fonts/manrope-latin.woff2`
- `src/app/layout.tsx`
- `src/app/onboarding/page.tsx`
- `src/components/billing/subscription-overview.tsx`
- `src/components/finance/finance-dashboard.tsx`
- `src/components/inventory/inventory-dashboard.tsx`
- `src/components/modules/backend-contract-notice.tsx`
- `src/components/modules/empty-module-state.tsx`
- `src/components/modules/integration-banner.tsx`
- `src/components/modules/management-form.tsx`
- `src/components/modules/period-selector.tsx`
- `src/components/packages/packages-dashboard.tsx`
- `src/components/reports/advanced-report-dashboard.tsx`
- `src/components/reviews/review-center.tsx`
- `src/components/workspace/create-workspace-form.tsx`
- `src/config/app-navigation.ts`
- `src/lib/auth/actions.ts`
- `src/lib/auth/permissions.test.ts`
- `src/lib/billing/plans.ts`
- `src/lib/marketing/content.ts`
- `src/lib/modules/actions.test.ts`
- `src/lib/modules/actions.ts`
- `src/lib/modules/management.test.ts`
- `src/lib/modules/mutations.ts`
- `src/lib/modules/periods.ts`
- `src/lib/supabase/database.types.ts`
- `src/lib/workspace/labels.ts`
- `supabase/migrations/20260925201418_trial_selected_plan.sql`
