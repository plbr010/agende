# Atualização do rollout — 10/10/2026

Produção `wohimauqgywshbbejjcl` permanece sem alterações nesta missão.
O catálogo e os hashes do histórico foram consultados novamente: coincidem
com o snapshot completo de 09/10, incluindo os guards de membership e a
divergência histórica. Ver `remote-recheck-2026-10-10.json`.

O [runbook anterior](launch-final-rollout-2026-10-09.md) continua aplicável.
O lote agora contém **cinco** migrations pendentes, nesta ordem:

1. `20260927014947_launch_readiness_reviews.sql`.
2. `20261008131859_launch_hardening_reviews_force_rls.sql`.
3. `20261009172028_launch_observed_owner_guard.sql`.
4. `20261009173042_billing_reconcile_excess_seats.sql`.
5. `20261010232248_atomic_service_professional_links.sql`.

## Efeito e dependências da quinta migration

Cria a RPC pública `save_service_with_professionals` e uma implementação no
schema privado app. Executa somente para owner/admin confirmado de workspace
com entitlement. Obtém o lock de membership, valida todos os profissionais
ativos do mesmo workspace e grava serviço e vínculos na mesma transação.
Vínculos existentes são ativados/desativados; não são apagados. Overrides de
preço e duração são preservados. Erros em qualquer vínculo reverterão todo o
save. Arrays inválidos/sem profissionais são rejeitados; IDs de outro tenant
ou serviço inexistente são recusados sem sucesso falso.

Depende de services, professional_services, professional_profiles,
workspace_members, require_workspace_manager e lock_workspace_membership.
Não apaga/recria tabelas ou dados. A RPC não existia no remoto consultado;
se já existir no preflight futuro, comparar a definição antes de aplicar.

Inclui `NOTIFY pgrst, 'reload schema'`, entregue após o commit, conforme a
[documentação de cache do PostgREST](https://docs.postgrest.org/en/stable/references/schema_cache.html#schema-cache-reloading-with-notify).
PostgREST não está disponível no teste PGlite: depois de aplicar em staging,
confirmar que a RPC aparece na Data API e que o cache foi recarregado.

## Ordem operacional: exige aprovação

Não apontar testes autenticados para previews atuais: production, preview e
development compartilham URL/key do Supabase de produção na Vercel.
Primeiro fornecer configuração isolada de staging PG17/Auth/SMTP e Stripe TEST.

Revisar os cinco SQLs, backups, fingerprints e leitura atual de
`supabase/checks/launch-final-preflight.sql`. Validar todas as migrations e
RPCs em staging. Após aprovação explícita, aplicar o lote por executor de
migrations autorizado, sem repair/db push cego ou alteração manual de histórico.
Se a ferramenta exigir mudança no histórico divergente, parar e aprovar um
procedimento específico baseado em fonte comprovada.

O aplicativo deste PR exige a quinta RPC para gravar serviços. Deploy da
aplicação antes da validação do banco fará essa action retornar indisponibilidade;
ela não recorre ao fluxo antigo que pode salvar parcialmente.
Aplicar/validar o banco antes da liberação da versão de aplicação.

Após aplicação autorizada, consultas somente leitura devem confirmar versões,
tabela/RPCs de avaliações, FORCE RLS, RPC de slots, fingerprints e grants.
Em staging, exercer create/edit de serviço, rejeição de IDs estrangeiros,
rollback de erro de vínculo e preservação dos overrides. Também testar as
jornadas de Auth, reserva/reagendamento, cancelamento e cobrança TEST.

## Origem de Auth e configuração operacional

O código passa a usar a origem configurada explicitamente ou o host confiável
das variáveis de sistema da Vercel. Produção prioriza
VERCEL_PROJECT_PRODUCTION_URL; preview usa VERCEL_URL. Nunca infere o destino
de e-mail de um Host/Origin arbitrário. Um deploy sem origem válida falha
com mensagem genérica em vez de enviar links para localhost.

Não foram alteradas variáveis Vercel nem URLs/SMTP de Supabase Auth. Validar
a allowlist de callbacks e o envio real em staging, depois definir a origem
canônica de produção e autorizar qualquer mudança de configuração.

Evidências locais: `atomic-service-sql.test.mjs`, `action-sql-integration.test.mjs`
e `site-origin.test.ts`. Auth, cache Next e transporte Supabase estão simulados
nesses testes; SQL e constraints são executados de verdade em PGlite PG18.3.
Isso não substitui PostgREST/Auth/SMTP, staging PG17 ou prova de concorrência
com conexões independentes.
