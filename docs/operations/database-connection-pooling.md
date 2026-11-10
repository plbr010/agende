# Conexões ao Postgres no Agendê (serverless)

Auditoria em 2026-11-10. **Este documento não aplica configurações no projeto
Supabase hospedado.** Produção não foi alterada.

## Caminho efetivo das consultas

- Browser: `src/lib/supabase/client.ts` usa `createBrowserClient`.
- Vercel/Next.js: `src/lib/supabase/server.ts` e
  `src/lib/supabase/proxy.ts` usam `createServerClient`, com autenticação
  e cookies por requisição. Não compartilhar clientes autenticados entre
  usuários ou invocações.
- Rotas privilegiadas: `src/lib/supabase/avatar-admin.ts` utiliza
  `@supabase/supabase-js` por HTTPS, sem conexão TCP ao Postgres.
- Edge Functions Stripe: `stripe-webhook` e `stripe-billing` usam
  `@supabase/supabase-js` por HTTPS; os clientes são inicializados no
  escopo do módulo e podem ser reutilizados pelo worker.
- `pg` está em `devDependencies` para testes SQL locais. Não é dependência
  do código de aplicação em produção.
- Vercel: sem variáveis `DATABASE_URL`, `POSTGRES_URL` ou `PGHOST`
  observadas na auditoria de nomes de variáveis em 2026-11-10.

**O supabase-js não abre uma sessão Postgres em cada chamada.** A Data API
(PostgREST) gerencia seu próprio pool. Criar/encerrar o cliente SSR por
requisição não equivale a criar/encerrar uma conexão ao banco. Não substituir
esse acesso por conexões diretas e não adicionar pools SQL por instância de
função sem revisão explícita.

Referência: https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers

## Pooler local

`supabase/config.toml` ativa o Supavisor **local**, em modo `transaction`:
- `port = 54329`
- `default_pool_size = 10` (conexões ao servidor por par papel/banco)
- `max_client_conn = 100` (limite de clientes do pooler local)

Isso é usado somente no Supabase CLI local, e **não** altera o pooler da
instância hospedada. O app Next.js segue utilizando a API HTTPS mesmo em
desenvolvimento. O teste `connection-policy.test.ts` evita regressões que
introduzam drivers ou URLs PostgreSQL diretas no runtime.

## Diagnóstico de produção (somente leitura)

Consultas pontuais no Supabase de produção, 2026-11-10:

- `max_connections = 60`, sendo 3 reservadas a superusuário;
- `statement_timeout = 120000 ms` no escopo consultado;
- `idle_in_transaction_session_timeout = 0` e
  `idle_session_timeout = 0` (valores padrão);
- 7 entradas observadas em `pg_stat_activity`, 5 ociosas,
  **0** `idle in transaction`;
- conexões ociosas identificadas como PostgREST, PgBouncer,
  `supabase_admin` e worker `pg_net`. Isso é esperado para serviços
  persistentes, não evidência de vazamento das invocações Next.js.
- Advisors do Supabase para saúde: sem alertas retornados.

```sql
SELECT current_setting('max_connections')::int AS max_connections,
       current_setting('superuser_reserved_connections')::int AS reserved,
       count(*) FILTER (WHERE backend_type = 'client backend') AS backends,
       count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction
FROM pg_stat_activity
WHERE datname = current_database();

SELECT usename, application_name, backend_type, state, count(*)
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY 1,2,3,4
ORDER BY 5 DESC;
```

## Timeout e desligamento de conexões ociosas

Não aplicar `idle_session_timeout` global à instância gerenciada só para
zerar o número de sessões `idle`: isso derrubaria também sessões persistentes
mantidas por PostgREST/Auth/poolers. No caminho atual, os clientes Next.js
não detêm conexões SQL a serem encerradas, e a liberação/reciclagem ocorre
dentro do pool gerenciado do Supabase.

`idle in transaction` por vários minutos seria uma anomalia real; investigar
o serviço e a origem, e testar qualquer alteração de
`idle_in_transaction_session_timeout` primeiramente em staging antes
de introduzir ajustes de escopo em produção. O valor `0` atual não deve
ser interpretado como garantia de encerramento de transações abandonadas.
Não existe garantia absoluta de ausência de saturação sob carga arbitrária.

## Se um driver SQL for necessário no futuro

1. Para funções serverless, usar a URI **Transaction pooler / Supavisor**
   fornecida pelo dashboard deste projeto, porta **6543**, nunca
   `db.<project-ref>.supabase.co:5432` (direta) para tráfego por invocação.
2. Adotar limite inicial de **1 conexão por instância** e fechamento no
   `finally` ou reciclagem com `idleTimeoutMillis` curto, timeout de
   conexão definido e espera por conexão limitada. A configuração exata
   depende do driver e da concorrência medida.
3. Verificar suporte a prepared statements: o modo transação do Supavisor
   pode exigir sua desativação no driver. Usar SSL e manter credenciais
   somente no servidor.
4. Consultar `Dashboard > Database > Settings > Connection pooling`.
   A configuração hospedada é separada de `config.toml`. Como o Agendê
   usa PostgREST, não reservar uma fração excessiva das 60 conexões
   disponíveis para Supavisor; usar métricas e deixar capacidade para
   Auth/Storage/PostgREST. O valor efetivo não foi auditado nem modificado.
5. Rodar teste de carga em staging, inspecionar uso de conexões, p95, erros
   de timeout e `Max client connections reached`, antes de ampliar limites.

Referências:
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/database/connection-management
