# Correções dos bloqueios finais — 26/10/2026

Base: `d39b2802f393eafbdc628d2a24f8368a685569b0` (#84–#88). Este PR propõe correções e apresenta evidências locais; não autoriza merge, migrations remotas, deploy, promoção, Stripe LIVE ou ativação real.

## Correções

- Zod `4.6.5` → **`4.6.6` exato**, com alteração apenas de Zod no lockfile. O [advisory GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) informa 4.6.6 como versão corrigida. `npm audit --omit=dev --audit-level=high`: zero vulnerabilidades.
- Migration aditiva `20261026091115_expired_appointment_cancellation.sql`: permite cancelar reserva existente após trial e cortesia expirarem ou serem revogados. O trigger exclusivo de appointments permite apenas a mudança de status para cancelled, preservando todas as outras colunas, exceto updated_at. Não altera o gate genérico de serviços, financeiro, estoque ou pacotes.
- RPC da equipe continua exigindo e-mail confirmado, membro ativo, `appointments.cancel`, escopo de profissional e transição válida. A repetição autorizada do cancelamento retorna o mesmo ID sem escrever novamente. A RPC do cliente preserva vínculo do cliente, prazo mínimo e proibição de cancelar estados terminais/em atendimento.
- As duas operações bloqueiam a linha antes de validar seu estado; duas sessões PG17 demonstram que um início concorrente não é sobrescrito por cancelamento com estado antigo. Não foi introduzido GUC de bypass nem grant de criação.
- Corrigido outro bloqueio do CI encontrado em #88: atualização de `slotActionRef.current` passou do render para um effect, antes do effect de consulta de slots. Lint retorna zero erros, com dois warnings anteriores em scripts de preparação.

## Migrations e divergência histórica

Inventário offline reproduzível: `node scripts/prepare-launch-final-plan.mjs`. Entrada: `launch-final-catalog-readonly.json`, obtida apenas por SELECT no catálogo de produção em 26/10. Saída: `launch-final-migration-plan.json`, com arquivos, ordem e SHA256 LF. O script não abre conexão nem executa repair.

Há **11 arquivos ausentes do ledger para este PR**: as nove migrations novas da base, uma migration histórica e a nova correção de cancelamento. Ordem:

1. `20261009172028_launch_observed_owner_guard.sql` — decisão separada de reconciliação histórica.
2. `20261023190000_commissions_permissions_settlement.sql`
3. `20261023190100_commissions_checkout_and_permissions.sql`
4. `20261023190200_commissions_rpcs_rls.sql`
5. `20261023190300_report_permission_and_receipts.sql`
6. `20261023190400_package_reversal_keeps_service_history.sql`
7. `20261024042359_pr84_financial_integrity.sql`
8. `20261025010715_pr84_final_integrity.sql`
9. `20261026091115_expired_appointment_cancellation.sql`
10. `20261026120000_pilot_workspace_booking_activation.sql`
11. `20261026153000_pr84_financial_entry_due_date.sql`

A nova migration foi criada com Supabase CLI 2.122.0 (`supabase migration new expired_appointment_cancellation`), sem renomear as migrations já existentes. Seu timestamp real é anterior às duas migrations de 26/10 com timestamps futuros na base. Ela depende das permissões de #84 e não depende do gate #86; a ordem acima foi ensaiada com o conjunto inteiro.

As **cinco definições de funções e o trigger de proteção de membros** do catálogo remoto coincidem exatamente com os blocos esperados da migration histórica 20261009172028, mas essa versão não está registrada no ledger. Isso comprova a coincidência dessas definições, não equivalência completa de ACLs, dados ou histórico. A versão `20260919201138_hardening_snapshot_owner_timezone` existe no ledger e não tem arquivo no Git. Não reconstruir seu SQL, não apagar seu registro e não executar migration repair automaticamente.

O ensaio local parte do baseline SQL conhecido, com dados sintéticos de receita paga e membros. Aplica os 11 arquivos e respectivos registros de histórico em uma única transação; uma falha forçada antes do COMMIT reverte tudo. A aplicação bem-sucedida preserva os valores legados, gera opening receipt de 1.000 centavos com chave `legacy:<id>`, e termina com criação suspensa. A reaplicação é recusada. Esse fixture não é um restore completo de produção.

Em produção, ainda é obrigatório reconferir catálogo, ACLs, ledger e hashes na janela autorizada. Backup restaurável/ensaio de restore, diagnóstico financeiro adaptado ao schema anterior, volume/locks e interrupção de mutações concorrentes continuam pré-condições. Não executar `db push` geral ou `pr84-preflight.sql` integralmente no schema antigo, onde receipts/comissões ainda não existem.

## Evidências e limites

Ambiente: Node 24.22.1, PostgreSQL 17.6 portátil em `127.0.0.1`, cluster criado e encerrado pelo runner; PGlite para a suíte padrão. Nenhuma DATABASE_URL remota é usada pelos runners. Auth/Storage/Cron são fixtures declarados.

| Verificação | Resultado / artefato |
|---|---|
| Suíte padrão | 505 eventos passaram, zero falhas, dois skips; `docs/homologation/launch-final-standard.json` |
| PostgreSQL 17 | 81 eventos passaram, zero falhas, um skip; `launch-final-native.json` e `launch-final-pg17.json` |
| Concorrência PG17 | Dez cenários gerais, mais concorrência de quitação/comissões e cancelamento com espera real por row lock; `launch-final-concurrency.json` e casos da suíte nativa |
| Advisors de segurança | Sem problemas no nível error, contra o banco PG17 local verificado; `launch-final-advisors.txt`. A mensagem genérica da CLI "Connecting to remote database" descreve uma URL explícita de loopback, não produção |
| Compatibilidade publicada | 12 eventos aprovados, zero falhas/skips; actions e parser financeiro do SHA publicado `a3923c4223e234365deb0d56c932ca53106920ef`, executados contra SQL atualizado; `launch-final-legacy-contracts.json` |
| Qualidade | Lint zero erros/dois warnings preexistentes; typecheck e build webpack aprovados |
| HTTP local sem sessão | Smoke da aplicação construída aprovado; `launch-final-smoke.txt`. Não representa aceite autenticado |

Os skips são o runner antigo de concorrência #86 que exige binário Linux PG16 (não presente no Windows); e, somente em PGlite, o teste de cancelamento concorrente que exige PG17 real. Este último passou na execução nativa. Os dez cenários de concorrência gerais rodaram em PG17, sem substituí-los por mocks de locks.

Comissões/recebimentos: ações reais de servidor, identidades SQL por papel, concessão/negação de permissões, profissional próprio/outro profissional, outro salão, snapshots, recebimento parcial/total, caixa na data de pagamento, quitação repetida, conflito de payload, reabertura, estorno e saldo de comissão; duas conexões em disputas financeiras. Nenhum pagamento ou evento Stripe LIVE é gerado.

Cancelamento: cliente/equipe após expiração completa e após desativação; isolamento por salão; deny explícito; profissional fora do escopo; e-mail não confirmado/anon; estados terminais; prazo mínimo; preservação de assinatura, dados financeiros e snapshots. Criação, remarcação, confirmação, reabertura, edição junto com cancelamento e UPDATE direto da API permanecem negados.

### Alcance da compatibilidade com a versão publicada

`AGENDE_ACTION_SOURCE_REF=a3923c4223e234365deb0d56c932ca53106920ef` habilita o modo reproduzível do teste de actions. Ele lê os módulos antigos por `git show`, incluindo mutações e decoder financeiro, e usa o banco atualizado. Dependências de framework, transporte Supabase e sessão são adaptadores locais; validadores compartilhados não alterados podem vir do checkout atual. O CI faz fetch completo, permitindo reproduzir o SHA antigo.

Passaram criação de salão/catálogo, agendamento, remarcação, conclusão, avaliação, cancelamento, financeiro, estoque/pacotes, negação de usuário estrangeiro e cancelamento após trial vencido. **Isso comprova compatibilidade dos contratos exercitados; não é execução do deployment binário antigo com Auth/HTTP reais.** Um rollback de aliases ainda precisa de aceite desse limite ou homologação integral isolada.

Fluxo verificado: ação do cliente/equipe → módulo real do servidor → RPC SQL sob identidade autenticada → banco → formato de resposta. Fronteira ainda não comprovada: navegador → cookies/sessão real → GoTrue/PostgREST. Docker/Supabase local completo não está disponível neste ambiente; nenhum teste foi desviado para produção ou staging compartilhado para contornar essa falta.

## Procedimento após aprovação e bloqueios restantes

**P0:** nenhum novo demonstrado pelos testes desta correção; não é garantia de ausência.

**P1 antes da publicação:** aceite do PR e CI desse SHA; homologação autenticada integral com GoTrue/PostgREST/cookies em ambiente isolado; plano e ensaio recuperável de backup/restore; compatibilidade operacional do rollback e volume/locks; aprovação explícita da aplicação dos arquivos/histórico. Nenhuma dessas autorizações é inferida pela criação deste PR.

**P1 para pagantes:** mantém-se a pendência de entrega Stripe LIVE autêntica e ciclo comercial/entitlement. Reentrega, cobrança e alteração de inscrições continuam exigindo autorizações próprias. O piloto gratuito não depende de cobrança real quando sua cortesia estiver validada.

**P2 / decisão:** selecionar único UUID/prazo/responsável; a cortesia concede entitlement do produto inteiro e o schema admite múltiplas exceções. Manter pausa global e verificar ausência de outra exceção ativa. Desativação emergencial deve revogar exceções/cortesias antes de suspend, pois um sync posterior pode reabilitar grants para exceções sobreviventes. O corte de transações de criação já iniciadas requer procedimento de lock/COMMIT aceito.

Código novo contra banco antigo continua incompatível nos módulos novos. Após COMMIT do upgrade, rollback do app não reverte receipts, settlements, comissões, ACLs ou cortesia. Preservar os ledgers e corrigir aditivamente/por compensação aprovada; não remover tabelas nem restaurar backup por conta própria. Para uma falha antes de COMMIT, o rollback transacional foi comprovado localmente.

Recomendação: **pronto para revisão do PR; NO-GO operacional até fechar os P1 e aprovar separadamente migrations, candidato, promoção e piloto**. Nenhum merge, deploy, migration remota, repair, operação Stripe LIVE ou reativação real foi executado. O acompanhamento existente não foi modificado.

## Reproduzir

```powershell
node scripts/prepare-launch-final-plan.mjs
npm audit --omit=dev --audit-level=high
npm test
$env:AGENDE_PG_BIN='<diretório dos binários PostgreSQL 17>'
node scripts/run-commission-pg17.mjs scripts/expired-cancellation-sql.test.mjs scripts/pilot-booking-activation.test.mjs scripts/launch-final-upgrade.test.mjs scripts/commissions-sql.test.mjs scripts/commissions-integrity-sql.test.mjs scripts/commissions-upgrade-sql.test.mjs scripts/pr84-final-sql.test.mjs scripts/pr84-final-upgrade.test.mjs scripts/action-sql-integration.test.mjs scripts/pg17-concurrency.test.mjs scripts/pr84-local-advisors.test.mjs
$env:AGENDE_ACTION_SOURCE_REF='a3923c4223e234365deb0d56c932ca53106920ef'
node scripts/run-commission-pg17.mjs scripts/action-sql-integration.test.mjs
Remove-Item Env:AGENDE_ACTION_SOURCE_REF
```

Node >=22 é obrigatório. Os comandos são locais e não autorizam sua adaptação para qualquer destino remoto.
