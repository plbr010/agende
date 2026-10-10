# Rollout técnico pendente — 09/10/2026

Projeto: `wohimauqgywshbbejjcl` (Agendê, produção). **Não aplicado.**
Este documento prepara a operação; não constitui aprovação de produção.

## Estado observado por leitura

- 63 versões remotas. As quatro migrations listadas abaixo não estão aplicadas.
- Ausentes: `appointment_reviews`, `submit_appointment_review` e
  `list_my_reschedule_slots`. O read model remoto ainda não inclui todos os IDs
  necessários ao reagendamento da aplicação atual.
- 31 tabelas públicas com RLS e FORCE RLS; tabela privada de leases com RLS,
  sem policy de usuário. Nenhuma view pública. `anon` lê somente `plans`.
- Todas as funções SECURITY DEFINER de app/public pinam search_path vazio.
- As políticas, colunas, constraints e índices existentes coincidem com a
  baseline local, exceto o constraint trigger de último owner ausente no Git.
  O catálogo de NOT NULL do PostgreSQL 18 local é normalizado separadamente;
  nullability também foi comparada nas colunas. Produção usa PostgreSQL 17.6.
- Duas funções extras e cinco implementações com locks de membership no remoto
  foram capturadas por leitura. A migration nova aceita apenas as definições
  locais conhecidas ou as remotas observadas; não atribui sua origem ao
  histórico vazio de 20260919201138.

## Histórico: não usar repair/db push por suposição

`20260919201138_hardening_snapshot_owner_timezone` tem `statements=[]`.
Além disso, 20260918203839, 20260918203840 e 20260918203841 registram apenas
`-- applied via execute_sql`, sem o SQL original. Seus objetos atuais estão no
catálogo e foram comparados; isso não recupera o SQL originalmente executado.

Das outras 59 versões, 34 coincidem no hash com arquivos normalizados para LF,
18 diferem apenas nos comentários iniciais/fim de arquivo, e sete ainda têm
diferenças textuais. A inspeção dessas sete mostrou comentários, formatação
e agrupamento de expressões de policies; o catálogo efetivo coincide nos
objetos comparados. Isso **não** prova igualdade byte a byte do histórico.

Não criar placeholder para a versão ausente, reaplicar versões antigas,
inserir manualmente registros no histórico, nem executar migration repair.
`db push` não é uma operação autorizada enquanto o histórico divergente não
tiver um procedimento aprovado. Recuperar originais por backup/logs/autor
é uma tarefa separada; não impede a revisão dos quatro SQLs aditivos abaixo.

## Lote exato para revisão e aplicação autorizada

| Ordem | Arquivo | Efeito |
| --- | --- | --- |
| 1 | `20260927014947_launch_readiness_reviews.sql` | Cria tabela/policy/RPC de avaliações, slots de reagendamento e amplia list_my_appointments |
| 2 | `20261008131859_launch_hardening_reviews_force_rls.sql` | FORCE RLS nas avaliações e search_path em SECURITY DEFINER sem configuração |
| 3 | `20261009172028_launch_observed_owner_guard.sql` | Reproduz os guards observados; mantém definições remotas conhecidas, aborta sobre qualquer divergência |
| 4 | `20261009173042_billing_reconcile_excess_seats.sql` | Corrige reconciliação de cancelamento/falha de pagamento e bloqueia downgrade com assentos excedentes |

Pré-condições: backup/PITR confirmado pelo operador, revisão do lote e dos
grants, leitura atual de `supabase/checks/launch-final-preflight.sql`, staging
isolado em PostgreSQL 17 com Auth, e execução das jornadas autenticadas.
Revisar também se as migrations apareceram desde este snapshot: nunca
reaplicar a primeira migration contra uma tabela já existente.

A primeira depende de appointments, workspaces, workspace_clients, serviços,
profissionais, auth.users e helpers de booking/entitlement existentes.
A segunda depende da primeira. A terceira depende de workspace_members,
workspaces e funções de gestão existentes. A quarta depende da sincronização
Stripe e helpers de limite de assentos existentes. Nenhuma tabela é apagada
ou recriada; as novas migrations não removem membros, reiniciam trial ou
alteram o histórico remoto.

Aplicar em transação pelo executor de migrations aprovado, que registre as
versões corretamente. Se ele exigir repair, alteração manual de histórico ou
substituir definições inesperadas, **parar** e submeter o procedimento à
aprovação separada. Não há comando genérico de db push autorizado aqui.

## Evidência de dry-run

`scripts/final-hardening.test.mjs` cria PostgreSQL em memória, executa a
baseline, importa somente as sete definições de membership e o trigger
observados, cria fixtures locais e aplica as quatro migrations em transação.
Verifica preservação de trial/dados, manutenção das definições remotas,
idempotência das novas migrations e rollback sobre função inesperada.
PGlite 0.5.8 usa PostgreSQL 18.3; esse teste não substitui staging PG17.

Em banco local, o bug de billing foi reproduzido antes da correção:
`plan_seat_limit_exceeded` impedia até um cancelamento após downgrade externo.
Depois da correção, canceled/past_due são persistidos e bloqueiam acesso.
Active/trialing com assentos excedentes vira expired: não mantém acesso do
plano anterior. Datas de trial, bindings e membros são preservados.
RPCs financeiras foram executadas como service_role; authenticated é negado.

## Validação após aplicação, sem fixtures em produção

Reexecutar somente as consultas de preflight e conferir as quatro versões,
tabela, RPCs, FORCE RLS, fingerprints e grants. Em staging, testar client
confirmado e outro tenant: avaliação única de atendimento concluído, IDOR,
leitura pela equipe, reagendamento com duração original, cancelamento,
past_due, renovação, replay e limites de assentos. Testar os dois guards
contra alteração do último owner e permissões de todas as roles.

Downgrade externo incompatível bloqueia acesso operacional. O titular pode
restaurar um plano compatível pelo Portal; redução de membros após bloqueio
requer procedimento administrativo autorizado. Não há desativação automática
de profissionais ou remoção de dados.

Uma falha de SQL deve reverter a transação, não iniciar rollback destrutivo.
Após commit, qualquer correção será outra migration revisada. Não remover
avaliações ou recriar tabelas como forma de rollback.

Evidências: `remote-final-2026-10-09.json`, `drift-final-2026-10-09.json`,
`security-final-2026-10-09.json` e `edge-final-2026-10-09.json`.
