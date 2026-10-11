# Homologação técnica — 10/10/2026 (BRT)

**Decisão: NO-GO para clientes pagantes.** A aplicação compila e os testes locais passam, mas produção ainda não contém objetos necessários e não houve homologação de Auth/SMTP/Stripe em serviços isolados. As evidências JSON têm timestamps UTC (11/10 corresponde à noite de 10/10 BRT).

## Código e alterações

Base inicial: `f391d5d5bb8d4c88c8f20f22634ffe158573c96d`, com PRs #19–#22 integrados. A main recebeu #23 durante a auditoria e foi integrada sem conflitos: `e0a716da46ac0f29f65dc400c69b27af7888a7aa`. Branch: `codex/launch-final-integration`. Nenhuma alteração da branch do Cursor. Next.js e eslint-config-next permanecem em **16.3.8**; regressões anteriores preservadas.

Esta entrega acrescenta execução SQL em PostgreSQL nativo 17, oito regressões de concorrência, proteção do executor contra conexão com banco externo, verificador de isolamento e classificação explícita das evidências. Não duplica as correções de aplicação já integradas: origem Auth, falha segura de sessão/logout e gravação atômica de serviço/profissionais. Não acrescenta migrations nem altera produção.

## Resultados executados

| Verificação | Resultado / alcance |
|---|---|
| `npm ci` | PASS, lockfile atualizado; Node 24.19.0 |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | 223 PASS após integrar #23, zero falhas e zero skips |
| `npm run build` | PASS, Next.js 16.3.8 |
| `npm run test:smoke` | 32 PASS HTTP no build local; visitas anônimas |
| `npm run test:postgres` | 43 PASS no PostgreSQL 17.6, zero falhas/skips; 67 migrations e cinco suítes SQL adicionais PASS |
| `node scripts/audit-schema-drift.mjs` | comparação local concluída; divergências documentadas abaixo |
| `npm audit --omit=dev` | zero vulnerabilidades de produção |
| GETs em `https://agende-lac.vercel.app` | 32 PASS; nenhuma conta/formulário/cobrança criada |

`standard-tests.json`: 133 unitários/contratos estáticos, 47 mocks de plataforma, oito mocks Stripe, 26 SQL PGlite e nove integrações SQL com Auth simulado. A classificação é conservadora por arquivo: um arquivo que usa mocks pertence ao grupo de mocks, mesmo contendo algumas assertions puras.

`native-tests.json`: 26 SQL PostgreSQL, nove integrações com Auth simulado e oito concorrências nativas. **Os 35 casos SQL/integração repetem casos da suíte padrão; não somar 223 + 43 como casos únicos.** As cinco suítes SQL são execução complementar, sem inflar a contagem de casos Node. O #23 não mudou migrations, ações SQL ou suítes nativas, já verificadas.

`pg17-concurrency.json` registra sessões diferentes e espera real por lock antes da liberação da transação concorrente. Casos: reserva da mesma vaga; rollback libera a vaga; reagendamentos concorrentes; avaliação única; preservação do último owner; último assento do plano; replay do mesmo evento de billing; lease de checkout. Todos passaram. O cluster usa somente loopback, dados sintéticos, sem serviço Windows, foi parado após a execução e seus dados estão ignorados pelo Git.

## Alcance por fluxo

| Fluxo | Evidência | Limitação |
|---|---|---|
| Cadastro cliente/profissional, confirmação, recuperação, login/logout, redirecionamentos | testes de aplicação com mocks e GETs anônimos | GoTrue, cookies reais, SMTP e recebimento de e-mail **BLOQUEADOS**, sem Auth isolado |
| Trial único sete dias, vencimento, papéis, assentos, isolamento, autorização RPC | SQL local PGlite + PostgreSQL 17.6; claims Auth sintéticos | não valida integração PostgREST/GoTrue de staging |
| Avaliações, reservas e reagendamento | SQL local e concorrência PostgreSQL real | objetos de avaliações/reagendamento ausentes em produção |
| Serviço + profissionais | ação com cliente/Auth simulado e RPC SQL real local | RPC ausente em produção |
| Seis checkouts, mensal/anual, trial, Portal, cancelamento, recusa, renovação, webhook | mocks Stripe + SQL local; leitura da configuração LIVE | nenhum checkout, test clock, evento externo ou pagamento executado; sandbox não conectado |

## Estado remoto observado (somente leitura)

**Supabase:** `wohimauqgywshbbejjcl`, PostgreSQL 17.6.1.166, saudável. 63 entradas remotas contra 67 arquivos locais; cinco pendentes e uma entrada exclusivamente remota. Inventário de tabelas/colunas/constraints/índices/policies/grants/funções/triggers e hashes do histórico permanecem iguais ao snapshot de 09/10 (`supabase-current.json`). Todas as 31 tabelas públicas têm RLS + FORCE RLS; a tabela interna de lease tem RLS sem policy, deliberadamente acessada por RPC. Zero SECURITY DEFINER sem search_path seguro no inventário. Advisor ainda alerta exposição EXECUTE de wrappers (cinco anon e 53 authenticated); autorização dos corpos e isolamento são exercitados localmente, não uma comprovação de todas as chamadas externas. Proteção de senha vazada está desativada. Sem branch/staging Supabase disponível.

O histórico `20260919201138_hardening_snapshot_owner_timezone` tem `statements=[]`; os registros `20260918203839/40/41` contêm placeholders de aplicação por execute_sql. Não reconstruir SQL por suposição nem executar repair/db push indiscriminado. O alvo local reproduz o owner guard observado; permanecem diferenças de grants gerados pela plataforma que exigem revisão, não sincronização cega.

**Stripe:** única conta conectada LIVE `acct_1UH3D6Kii3CCJXtc`. Seis preços ativos BRL (três produtos, mensal/anual) confirmados somente por GET. Webhook ativo com oito eventos para a Edge Function de produção, API `2026-08-26.dahlia`. Nenhum sandbox acessível. Portal padrão `bpc_1UJovBKii3CCJXtcbHEUcBZm` tem `subscription_update.enabled=false`: upgrade/downgrade pago indisponível. Sua opção inativa `trial_update_behavior=end_trial` exige correção antes de habilitar trocas. Cancelamento está configurado para fim do período. Configuração e preços públicos em JSON; nenhum segredo armazenado.

**Vercel:** produção READY `dpl_3gUeeX8d6SNZxcwX9NYWu9Gja6C9`, commit `e0a716d` (#23), após deploy automático da main feito pelo fluxo existente. Projeto usa Node 24.x, região iad1. Alias atual `agende-lac.vercel.app`; `agendeapp.online` não aparece no projeto e DNS retorna NXDOMAIN. Apenas duas variáveis públicas Supabase, aplicadas igualmente a production/preview/development: falta isolamento; NEXT_PUBLIC_SITE_URL ausente. Os 32 GETs foram repetidos após #23 e passam, mas isso não valida e-mails/cookies. Consulta error/fatal de 30 minutos anterior ao #23 sem grupos retornados; não prova ausência de falhas fora desse recorte. Nenhuma configuração/deploy manual alterado.

## Bloqueios e prontidão

**P0:** cinco migrations ainda pendentes, RPCs/tabela necessários ausentes; development/preview compartilham backend de produção; Auth/SMTP e ciclo Stripe externo não homologados em ambiente isolado. Esses gates impedem afirmar prontidão comercial.

**P1 antes de clientes:** habilitar e validar troca de planos com trial preservado e política financeira aprovada; configurar domínio pretendido e origens/redirects correspondentes; revisar SMTP/entrega e proteção de senha vazada; confirmar backup recuperável e aplicar/verificar schema aprovado. Cinco vulnerabilidades altas de desenvolvimento reportadas pelo `npm ci` permanecem fora do bundle de produção; avaliar correção separada sem `audit fix --force` ou quebra do framework.

**P2:** automatizar executor PostgreSQL nativo no CI com runner isolado; ampliar observabilidade e cobertura de falhas de provedores após liberação. A prontidão do código tem evidência forte local; a prontidão de operação **não está comprovada**. Não atribuir percentual arbitrário nem prometer data enquanto gates externos estão bloqueados.

As cinco ocorrências dev vêm de uma mesma cadeia `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. O registro npm ainda tem braces 3.0.3 como última versão e o [advisory oficial](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) informa nenhuma versão corrigida. O audit sugere downgrade de eslint-config-next a 14.2.35, incompatível com a exigência de manter 16.3.8; não foi aplicado. Não expor ferramentas de lint a padrões fornecidos por usuários e acompanhar patch upstream. Isso não elimina o alerta de desenvolvimento.

## Reprodução PostgreSQL nativo

Instalar/disponibilizar binários PostgreSQL 17 e usar Node >=22. No PowerShell:

```powershell
$env:AGENDE_PG_BIN = 'C:/caminho/pgsql/bin'
npm ci
npm run test:postgres
```

O runner cria cluster próprio em `.test-postgres`, porta dinâmica em 127.0.0.1 e databases sintéticos únicos. Não usa DATABASE_URL. O adaptador verifica versão, diretório real e cluster_name antes de escrever. Auth, Storage e Cron são fixtures SQL: não há GoTrue, SMTP, PostgREST ou scheduler real. Não definir manualmente AGENDE_NATIVE_PG_PORT/DATA para servidores existentes.

Execução desta auditoria usou binários EDB oficiais portáteis PostgreSQL 17.6, ZIP `https://get.enterprisedb.com/postgresql/postgresql-17.6-1-windows-x64-binaries.zip`, SHA256 `d378882abd001a186735acd6f6ba716bca6ccd192e800412d4fd15ed25376b3e`. Binários e dados ficam fora do Git. Ver [runbook](./RELEASE-RUNBOOK.md) para ações que exigem aprovação.
