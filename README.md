# Agendê

SaaS para profissionais da beleza e clientes finais. A fundação e o catálogo (equipe, serviços, clientes) estão prontos. Esta etapa adiciona **jornada, pausas, bloqueios, disponibilidade e agenda interna**.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Supabase Auth + PostgreSQL + Row Level Security
- Deploy previsto na Vercel

## Identidade

Uma pessoa tem **uma conta** (`auth.users` + `profiles`). Capacidades são compostas:

- `client_profiles` → área gratuita `/cliente`
- `workspaces` + `workspace_members` → negócio / tenant
- `subscriptions` pertencem ao **workspace**, não ao usuário

`intended_use` no cadastro é apenas roteamento inicial. Não é autorização.

## Rotas

| Rota | Acesso |
| --- | --- |
| `/` | pública |
| `/cadastro` `/login` `/verificar-email` | autenticação |
| `/onboarding` | e-mail confirmado, sem workspace |
| `/app` | membro de workspace |
| `/app/agenda` | agenda interna (dia/semana) |
| `/app/equipe` | cadastro de profissionais da equipe |
| `/app/equipe/[member]/disponibilidade` | jornada, pausas e bloqueios |
| `/app/servicos` | catálogo de serviços do workspace |
| `/app/clientes` | clientes internos do estabelecimento |
| `/cliente` | `client_profiles` |
| `/auth/callback` `/auth/confirm` | troca de código / token de e-mail |

Rotas privadas são barradas no **servidor** (proxy + `getUser()` + RLS).

## Trial

- Só começa ao criar o primeiro workspace, em transação no Postgres.
- 7 dias, `status = trialing`, datas com `clock_timestamp()`.
- `professional_trial_claims` impede trial extra após apagar/recriar.

## Segurança

- RLS deny-by-default em todas as tabelas públicas relevantes
- Funções `SECURITY DEFINER` no schema `app`, com `search_path` vazio
- Usuário autenticado **não tem** GRANT de INSERT/UPDATE/DELETE em `subscriptions`, `workspace_members` ou trial
- Colunas críticas protegidas por trigger
- Convites armazenam só `sha256(token)`

## Desenvolvimento

```bash
cp .env.example .env.local
npm install
npm run dev
```

Variáveis:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=
```

Nunca coloque service role em `NEXT_PUBLIC_*`.

No dashboard do Supabase:

1. Confirm email **ativado**
2. Site URL e Redirect URLs apontando para o app (`/auth/callback`, `/auth/confirm`)

## Scripts

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Banco

Migrations versionadas em `supabase/migrations`. Schema `app` não é exposto na Data API.

Não reescreva migrations já aplicadas no projeto remoto. Correções de banco entram em uma **nova** migration.

## Testes SQL da fundação

Os arquivos em `supabase/tests/` são executáveis: falham com `RAISE EXCEPTION` se uma regra quebrar.

Requerem uma conexão privilegiada (`postgres` / `service_role`), porque criam usuários em `auth.users`.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/helpers.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/foundation.sql
```

O segundo arquivo imprime a lista de casos que passaram. Usuários de teste usam o domínio `@agende-foundation.test` e são removidos ao final (também em caso de falha).

Catálogo (equipe, serviços, clientes do estabelecimento):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/helpers.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/catalog.sql
```

Agenda (jornada, conflitos, snapshots e IDOR):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/helpers.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/agenda.sql
```

## Agenda

- `weekday` 0–6 = domingo–sábado (`EXTRACT(DOW)` / `Date.getDay()`).
- Fuso único: `app.product_timezone()` e `src/lib/time/timezone.ts` (`America/Sao_Paulo`).
- Conflito: `EXCLUDE USING gist` em appointments ativos + `pg_advisory_xact_lock` no profissional. `cancelled` e `no_show` não ocupam horário.
- `price_cents` e `duration_minutes` são snapshot; override de `professional_services` ganha do catálogo. O browser não define preço, duração nem `ends_at`.
- Receptionist agenda e bloqueia horários, mas não edita jornada nem preços.
- Slots são calculados (não pré-gerados), passo de 15 minutos.
