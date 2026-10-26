# Ativação de agendamentos por estabelecimento

Proposta local. A migration **não foi aplicada** em produção nem em staging compartilhado. Nenhum salão real foi reativado, nenhum deploy foi feito e nenhuma coluna Stripe foi alterada. Este documento não declara o piloto pronto para uso real.

A reativação antiga (`docs/production-readiness/prelaunch20-resume-bookings.sql`) concede `EXECUTE` a todo usuário `authenticated`. Esse script permanece intacto. Depois desta migration ele volta a conceder a chamada, mas o gate de dados continua recusando estabelecimentos sem exceção ativa.

## O que já existia

O direito de usar o produto continua em um único lugar: `app.workspace_has_entitlement`. Ele aceita assinatura `trialing` com `trial_ends_at` no futuro, ou `active` com fim de período nulo ou futuro. `app.assert_workspace_entitled`, `app.actor_member`, `app.resolve_public_workspace` e o trigger `appointments_entitlement_gate` já usam essa função. O trial continua único por usuário em `professional_trial_claims`. A linha de `public.subscriptions` continua imutável sem `app.bypass_protected_columns`.

O bloqueio global de hoje é de privilégio: `prelaunch20-stop-bookings.sql` revoga `EXECUTE` das duas funções públicas de criação e o `INSERT` direto. Não havia exceção por UUID. `INSERT` direto em `public.appointments` já estava revogado de `anon` e `authenticated`, com RLS forçado e políticas só de leitura.

Esta mudança não cria um segundo status de assinatura. Ela acrescenta um gate de criação em cima do entitlement existente.

## Regra

Criar ou remarcar um agendamento exige as duas condições:

1. O estabelecimento tem entitlement (trial, período pago ou cortesia vigente).
2. A pausa global está desligada **ou** existe exceção habilitada, não revogada e não vencida para aquele UUID.

Sem entitlement, o erro continua `workspace_subscription_inactive`. No caminho público, `app.resolve_public_workspace` traduz a falta de entitlement para `workspace_unavailable`. Com entitlement e sem exceção, o erro novo é `booking_creation_paused` (`42501`).

Tabelas, todas em `app`, com RLS forçado e sem privilégio para `anon`, `authenticated` ou `service_role`:

- `app.booking_creation_controls`: uma linha, `globally_paused` começa `true`.
- `app.booking_workspace_exceptions`: exceção por UUID, com `expires_at` e `revoked_at`.
- `app.complimentary_entitlements`: cortesia lida por `workspace_has_entitlement`. Não grava `subscriptions`, trial claims nem Stripe. O vencimento é o mesmo da exceção. A janela máxima é 90 dias.

O trigger `appointments_booking_creation_gate` roda `BEFORE INSERT OR UPDATE`. `INSERT` sempre passa pelo gate. `UPDATE` só quando mudam horário, profissional, serviço ou estabelecimento. Cancelar ou concluir não é bloqueado por este trigger. `app.bypass_entitlement` não abre a agenda. Nenhuma linha é apagada.

A policy restritiva `appointments_no_direct_insert` recusa `INSERT` de `anon` e `authenticated`, inclusive no salão autorizado. As RPCs são `SECURITY DEFINER` e passam pela policy do dono; o trigger ainda as barra. `service_role` tem `BYPASSRLS`, então a policy não o alcança: o trigger alcança.

As funções de operador ficam em `app`, fora dos schemas expostos (`public`, `graphql_public`):

- `app.activate_workspace_booking(uuid, timestamptz, text)`
- `app.deactivate_workspace_booking(uuid)`
- `app.suspend_booking_creation()`

Se `request.jwt.claim.role` for `anon` ou `authenticated`, elas levantam `booking_activation_denied`, mesmo que alguém conceda `EXECUTE` por engano. `EXECUTE` vai só para `service_role`. `app.sync_booking_creation_privileges` concede `EXECUTE` das duas funções públicas a `authenticated` somente quando a pausa está desligada ou existe alguma exceção vigente. Caso contrário, revoga. Nunca concede `anon` nem `INSERT`.

A migration termina com `SELECT app.suspend_booking_creation()`. Aplicá-la fecha a criação de novo. Ela não insere exceção e não faz `GRANT` de criação.

`app.create_appointment`, `app.create_public_appointment`, `app.list_available_slots` e `app.list_public_available_slots` chamam o gate antes de criar cliente, consumir rate limit ou devolver horários. Uma tentativa pausada não grava cliente nem evento de limite. Na agenda interna, a falta de horários por causa desse gate aparece como agenda fechada. Um dia realmente vazio continua com a mensagem de nenhum horário livre.

## Procedimento

Sessão privilegiada. O UUID não fica no arquivo. Não executar `supabase/tests/helpers.sql` em banco compartilhado: esse arquivo, só de teste, desliga a pausa global.

### Ativar um UUID

```sql
SELECT set_config('agende.confirm_pilot_activation', 'yes', false);
SELECT set_config('agende.pilot_workspace_id', '<uuid>', false);
SELECT set_config('agende.pilot_expires_at', '<timestamptz futuro, no máximo 90 dias>', false);
SELECT set_config('agende.pilot_note', '<texto opcional, até 200 caracteres>', false);
\i docs/production-readiness/pilot-booking-activate.sql
```

Isso grava a exceção e a cortesia com o mesmo vencimento, e concede `EXECUTE` a `authenticated`. Não mexe em assinatura, trial nem Stripe. Não desliga `globally_paused`. Não liga descoberta pública.

### Desativar um UUID

```sql
SELECT set_config('agende.confirm_pilot_deactivation', 'yes', false);
SELECT set_config('agende.pilot_workspace_id', '<uuid>', false);
\i docs/production-readiness/pilot-booking-deactivate.sql
```

Marca a exceção como desabilitada e revogada, revoga a cortesia e sincroniza o privilégio. Os agendamentos permanecem. Sem outra exceção vigente, `EXECUTE` de `authenticated` é revogado de novo.

### Parar todo mundo, inclusive o UUID já ativado

`docs/production-readiness/prelaunch20-stop-bookings.sql` ou `SELECT app.suspend_booking_creation()`. Os dois revogam `EXECUTE` mesmo que a linha de exceção continue. Para reabrir aquele UUID é preciso chamar a ativação outra vez. O script antigo de resume volta a conceder `EXECUTE` a todos os autenticados; o gate ainda recusa quem não tem exceção vigente.

O vencimento sozinho já bloqueia criação e remarcação dentro da função e do trigger, mesmo que o `EXECUTE` continue até alguém desativar ou suspender.

## Testes

Dois salões fictícios (`Salao Piloto Ficticio` e `Salao Bloqueado Ficticio`) em PGlite, em `scripts/pilot-booking-activation.test.mjs`. Conferido em 26/10/2026, por volta de 04:16 (America/Sao_Paulo):

- Pausa ligada, zero exceções, `EXECUTE` negado a `authenticated` e `anon`, `INSERT` negado. Criação pública e interna dos dois salões termina em `permission denied`. Nenhuma linha em `appointments`.
- `INSERT` direto no salão bloqueado, com `app.bypass_entitlement=on`, termina em `booking_creation_paused`.
- O dono não chama a ativação. `EXECUTE` concedido por engano a `authenticated` ainda termina em `booking_activation_denied` e não grava linha. Janela de 91 dias, data passada e UUID inexistente são recusados. O script sem a confirmação é recusado.
- `service_role` ativa só o UUID piloto por 30 dias. A linha de `subscriptions` e o claim de trial permanecem iguais. O outro salão não ganha exceção. `authenticated` recebe `EXECUTE`; `anon` não.
- Anônimo continua sem `EXECUTE`. E-mail não confirmado recebe `email_not_confirmed`. O salão bloqueado recebe `booking_creation_paused` sem cliente novo e sem agendamento. O piloto cria às 10:00 (público, `price_cents` 8000) e às 11:00 (interno). O bloqueado não cria no próprio salão nem no piloto. O dono bloqueado não vê nem cancela o agendamento do piloto. A lista pública do piloto devolve horários; a do bloqueado, pública e interna, levanta `booking_creation_paused`.
- Com `INSERT` concedido de propósito, `authenticated` esbarra na policy restritiva. `service_role` no salão bloqueado esbarra no trigger. `service_role` no piloto, no horário livre, grava a linha.
- Com a exceção vencida, nova reserva e remarcação falham com `booking_creation_paused`. O cancelamento ainda funciona enquanto o trial existe, e a linha permanece.
- Com o trial já vencido, o script de ativação reabre por cortesia sem alterar `trial_ends_at` nem `status`. Uma reserva nova entra. Depois que cortesia e exceção vencem, a reserva seguinte e a remarcação falham, o cancelamento da linha existente funciona e a linha continua. Voltar o status para `scheduled` continua recusado. O detalhe de papéis, permissão negada, cliente, salão vizinho e bypass está em `scripts/expired-entitlement-cancel.test.mjs`.
- Desativar sem confirmação falha. Com confirmação, a assinatura não muda, a exceção fica desligada e a criação seguinte falha. A linha permanece.
- O stop antigo volta a negar `EXECUTE`. O resume antigo reabre só o UUID que ainda tem exceção. O salão bloqueado segue em `booking_creation_paused` com zero agendamentos, e a assinatura dele permanece a original.

Concorrência em cluster PostgreSQL 16.15 privado, só em `127.0.0.1`, derrubado ao fim do teste. Não é o harness PostgreSQL 17 do repositório; esses binários não estão nesta máquina. Duas sessões disputam o mesmo horário do piloto: uma reserva, a outra recebe `slot_taken`. Duas tentativas simultâneas no salão bloqueado recebem `booking_creation_paused` e não gravam linha. O dono do bloqueado lê zero agendamentos do piloto.

`npm test` nessa mesma janela: 454 passaram, 0 falharam, 0 ignorados. Inclui a suíte acima, `database.test.mjs`, `launch-readiness.test.mjs`, `booking-retry-sql.test.mjs`, `profiles-booking-whatsapp-sql.test.mjs`, `discovery-sql.test.mjs`, `prelaunch-upgrade.test.mjs` e o mapeamento de `booking_creation_paused` em `sanitizeBookingError`. A mensagem da agenda interna está em `mapAgendaError`.

O CI não tem o binário em `/usr/lib/postgresql/16/bin`. Nesse caso o teste nativo é ignorado; o PGlite continua obrigatório. Nesta máquina o binário existe e o teste nativo rodou.

O navegador não foi usado contra um salão. Não há sessão de salão aqui, e produção não pode ser chamada. A mensagem pública foi coberta por teste de unidade; o caminho real de criação e isolamento foi o SQL acima.

## Riscos que permanecem

- A cortesia entra no entitlement do produto inteiro até vencer ou ser revogada, não só na agenda. Um salão com assinatura expirada volta a passar nos gates de entitlement (serviços e demais caminhos que chamam `workspace_has_entitlement`). Descoberta pública continua dependendo de `discovery_enabled`. A linha Stripe não é reescrita.
- O `GRANT EXECUTE` é do papel `authenticated`, não de um UUID. A proteção é a tabela de exceção vazia por padrão, mais o trigger. O resume antigo não abre todos os salões, mas reabre um UUID que ainda tenha exceção vigente.
- `suspend_booking_creation` não apaga a exceção. Uma desativação de outro salão chama o sync e pode devolver o `EXECUTE` se alguma exceção continuar vigente. Para parar o piloto, desative o UUID dele. Para parar todos, revogue o `EXECUTE` e não deixe outra exceção ativa antes de um sync.
- Superusuário consegue desligar trigger. Os papéis da API não.
- Depois que a cortesia e o trial acabam, criar, remarcar, concluir e marcar falta continuam recusados. Cancelar um horário em aberto continua possível: a migration `20261026180100_expired_entitlement_appointment_cancel.sql` libera só a passagem para `cancelled`, sem mudar horário, profissional, serviço, preço ou qualquer outro campo, e sem reabrir a exceção. A linha não é apagada. Um horário concluído ou já marcado como falta não entra nessa exceção. Enquanto o trial ainda vale e só a janela de agenda venceu, cancelar também funciona e remarcar não. Financeiro, relatórios, pacotes e estoque continuam sem leitura nesse estado e mostram o aviso de assinatura inativa, sem o erro genérico da área profissional.
- Aplicar a migration em um banco que hoje aceita reservas fecha a criação, porque o final chama `suspend_booking_creation`. Não aplicar em produção nem em staging compartilhado sem uma janela autorizada.
- A suíte nativa isolada desta branch rodou em PostgreSQL 17, com 97 testes e a concorrência incluída. Um cluster anterior de concorrência usou PostgreSQL 16.15.
