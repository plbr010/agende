# Drift GitHub × Supabase — 08/10/2026

Projeto remoto: `wohimauqgywshbbejjcl`. Nenhuma migration, DDL, repair, `db push`
ou `db reset` foi executada neste trabalho. O banco de produção **não** foi
alterado.

## Estado observado (snapshot de 27/09/2026 + Git atual)

O verificador offline `node scripts/verify-stripe-recovery.mjs` continua a
autoridade do snapshot remoto de 27/09/2026. Ele agora espera:

| Lado | Quantidade | Observação |
| --- | ---: | --- |
| Remoto (snapshot) | 63 | inclui `20260919201138_hardening_snapshot_owner_timezone` com SQL vazio |
| Git | 64 | 63 do snapshot − 1 remota vazia + 2 migrations de lançamento |

Divergências conhecidas:

1. **Git tem e o remoto ainda não aplicou**
   - `20260927014947_launch_readiness_reviews.sql` — cria `appointment_reviews`,
     `submit_appointment_review` e `list_my_reschedule_slots`.
   - `20261008131859_launch_hardening_reviews_force_rls.sql` — `FORCE ROW LEVEL SECURITY`
     na tabela de avaliações e rede de segurança de `search_path` vazio em
     funções `SECURITY DEFINER` de `app`/`public`.
2. **Remoto tem e o Git não reproduz**
   - `20260919201138_hardening_snapshot_owner_timezone` — registro remoto com
     `statements = []`. Não há SQL recuperável. **Não** criar arquivo vazio,
     placeholder ou reconstrução por suposição. Ver
     [recovery-2026-09-23.md](./recovery-2026-09-23.md).
3. **Tabela de avaliações ausente no remoto** — consequência direta do item 1.
4. **Alertas de SECURITY DEFINER** — esperados: wrappers públicos para PostgREST
   e RPCs autenticadas. Corpo com `search_path = ''`, `REVOKE` de `PUBLIC`/`anon`
   salvo RPCs anônimas de agendamento público, schema `app` fora da Data API.
5. **Testes Stripe de pagamento real** — ainda não executados. Os testes locais
   usam mocks/PGlite. Não há cobrança real neste repositório.
6. **Domínio `agendeapp.online`** — não está versionado no código. A Edge usa
   `AGENDE_SITE_URL` (fallback atual `https://agende-lac.vercel.app`). Confirmar
   o domínio no projeto Vercel e apontar `NEXT_PUBLIC_SITE_URL` e
   `AGENDE_SITE_URL` **depois** da confirmação, sem deploy automático daqui.

## Como validar ANTES de aplicar qualquer SQL no remoto

Executar somente leitura. Substitua a connection string privilegiada localmente;
não cole credenciais em commits, PRs ou logs.

```sql
-- 1) Histórico remoto versus Git
select version, name, cardinality(statements) as statement_count
from supabase_migrations.schema_migrations
order by version;

-- 2) Tabela de avaliações
select to_regclass('public.appointment_reviews') as reviews_table;

-- 3) FORCE RLS e políticas
select c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'appointment_reviews';

-- 4) SECURITY DEFINER sem search_path pinado
select n.nspname, p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prosecdef
  and n.nspname in ('app', 'public')
  and (
    p.proconfig is null
    or not exists (
      select 1 from unnest(p.proconfig) as cfg(value)
      where cfg.value like 'search_path=%'
    )
  );

-- 5) Objetos citados na migration vazia (não recriar se já existirem)
select n.nspname, p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('enforce_active_owner', 'lock_workspace_membership', 'workspace_timezone', 'product_timezone');
```

Critério de prontidão para aplicar as duas migrations de lançamento:

- `reviews_table` é `null`.
- `20260927014947` e `20261008131859` **não** aparecem em `schema_migrations`.
- A query (4) pode listar funções; a segunda migration só pina `search_path`
  quando estiver ausente. Funções já pinadas não mudam de corpo.
- `enforce_active_owner` / `workspace_members_keep_owner` no remoto **não**
  devem ser recriados às cegas. Se existirem, deixe-os. Não atribuir esse SQL
  à versão vazia `20260919201138`.

## Ordem de aplicação (somente após revisão humana)

Em staging ou no SQL editor, com backup e transação explícita:

1. Dry-run: abrir as duas migrations do Git e conferir que são aditivas
   (`CREATE TABLE`, `CREATE FUNCTION`, `ALTER TABLE ... FORCE`, `COMMENT`,
   `ALTER FUNCTION ... SET search_path`). Não há `DROP`, `TRUNCATE` ou rewrite
   de histórico.
2. Aplicar `20260927014947_launch_readiness_reviews.sql`.
3. Reexecutar as queries (2) e (3): a tabela existe, RLS ligado, FORCE ainda
   desligado neste passo.
4. Aplicar `20261008131859_launch_hardening_reviews_force_rls.sql`.
5. Reexecutar (2)(3)(4): `relforcerowsecurity = true`; query (4) vazia para
   `app`/`public`.
6. Registrar as versões em `supabase_migrations.schema_migrations` pelo fluxo
   oficial do CLI (`supabase db push` / dashboard), **nunca** inventando um
   registro para `20260919201138`.
7. Rodar localmente, contra uma cópia, as suítes em `supabase/tests/` e
   `node scripts/launch-readiness.test.mjs`. Não apontar esses testes para
   produção.

Se o passo 2 falhar porque a tabela já existe, **parar**. Não usar
`CREATE TABLE IF NOT EXISTS` improvisado no remoto; investigar o objeto
existente.

## O que este PR não faz

- Não aplica SQL no projeto Supabase de produção.
- Não reconstrói `hardening_snapshot_owner_timezone`.
- Não confirma o domínio na Vercel.
- Não dispara Checkout Stripe live nem eventos de webhook reais.
