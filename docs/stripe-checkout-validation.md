# Stripe Checkout e Portal — validação

Base: `main` após fetch, `09e866864d12ae63be26bd0759a8886b8cefe719` (PR #11).
Branch: `codex/stripe-checkout-live`. Nenhum merge ou deploy faz parte desta entrega.

## Auditoria antes da implementação

- Conferidos os hashes das seis migrations Stripe e dos dois entrypoints recuperados.
  As migrations antigas, os RPCs de vínculo/sincronização e o catálogo foram preservados.
  O verificador passa a comparar as funções recuperadas com o commit histórico, pois
  os entrypoints atuais recebem correções neste PR. O manifesto histórico não foi editado.
- Supabase Agendê `wohimauqgywshbbejjcl`: ambas as funções ACTIVE, versão 1;
  webhook com `verify_jwt=false`, billing com `verify_jwt=true`.
- Consulta somente SELECT em `public.plans`: Solo 8990/79900, Equipe 16990/149900,
  Salão 29990/279900 centavos, limites 1/5/15 profissionais.
- Consulta somente GET na conta Stripe Agendê confirmou os seis preços ativos em BRL,
  recorrência mês/ano com intervalo 1 e os lookup keys abaixo. Nenhum produto/preço
  foi criado, modificado ou arquivado. Os preços anuais legados sem lookup key continuam
  intactos e não são selecionados pela integração.

| Plano | Mensal | Anual |
| --- | --- | --- |
| Solo | `agende_solo_monthly` — R$ 89,90 | `agende_solo_annual` — R$ 799 |
| Equipe | `agende_equipe_monthly` — R$ 169,90 | `agende_equipe_annual` — R$ 1.499 |
| Salão | `agende_salao_monthly` — R$ 299,90 | `agende_salao_annual` — R$ 2.799 |

- Portal padrão `bpc_1UJovBKii3CCJXtcbHEUcBZm`: cartão, dados do cliente,
  histórico de faturas e cancelamento ao fim do período habilitados. Troca de
  plano/intervalo desabilitada. Essa configuração live não foi alterada.
- Webhook `we_1UJp7rKii3CCJXtctETUZwBY` habilitado, API `2026-08-26.dahlia`,
  destino correto, eventos Checkout completed/async success/async failed,
  subscription created/updated/deleted e invoice paid/payment_failed.

## Implementação

- Tela real com seis seleções e Portal condicional ao customer Stripe e à permissão.
  `STRIPE_CAPABILITIES.checkout` e `portal` habilitados no código.
- Server Action deriva o workspace da sessão confirmada e passa a chamada autenticada
  à Edge Function existente por `supabase.functions.invoke`. Nenhuma chave Stripe ou
  service role é enviada ao frontend; nenhum SDK Stripe foi adicionado ao bundle web.
- Owner/admin verificados tanto na action quanto na Edge Function. Plano incompatível
  bloqueado na tela e revalidado no backend. Falha na leitura de vagas bloqueia a tela.
- Retorno de sucesso/cancelamento é apenas mensagem. Atualizar dados relê o Supabase;
  não chama RPC de sincronização nem grava status a partir da query string.
- Redirects exigem HTTPS, host Stripe exato, sem credenciais nem porta alternativa.
  URLs de retorno são construídas exclusivamente pelo backend usando `AGENDE_SITE_URL`.
- Tentativas reutilizam idempotency key; lease de banco serializa criação; assinaturas
  existentes no Stripe bloqueiam duplicação mesmo antes do webhook chegar. Checkout
  aberto da mesma seleção é reutilizado; mudar seleção expira o link anterior.
- Trial usa a data original: >=48h via `trial_end`; de 5 minutos a 48h via
  `billing_cycle_anchor` sem proração; nos últimos 5 minutos o checkout é recusado
  com orientação em português para não antecipar cobrança. Trial vencido não reinicia.
- Migration adicional conserva a assinatura de `change_trial_plan`, bloqueando seu
  uso após vínculo com uma assinatura Stripe. Acrescenta RPCs de lease somente para
  service role, tabela interna com RLS, token de liberação e recuperação por expiração.

## Webhook e ciclo de vida

O backend anterior derivava status de invoice paid/failed usando períodos locais;
uma fatura de valor zero podia encerrar o trial local, e eventos antigos podiam
reativar um cancelamento. Agora consulta a assinatura atual no Stripe e usa o preço
efetivo, período e status atuais antes de chamar o RPC existente.

| Fluxo | Resultado |
| --- | --- |
| Checkout concluído | Vínculo via RPC existente e reconciliação imediata pelo webhook |
| Subscription antes de Checkout | Falha recuperável; Checkout também sincroniza após vincular |
| Renovação / recuperação de pagamento | Períodos e status da assinatura atual |
| Trial + invoice.paid de valor zero | Mantém `trialing` quando esse é o status Stripe |
| `past_due`, `unpaid`, `incomplete` | Mapeiam para `past_due`, conforme contrato existente |
| Cancelamento agendado | Permanece ativo até o Stripe efetivar o cancelamento |
| Cancelamento efetivo | `canceled`; invoice atrasada não reativa a assinatura |
| Troca de plano/intervalo por operação Stripe autorizada | Preço atual prevalece sobre metadata antiga |
| Preço desconhecido / múltiplos itens | Falha recuperável; não adivinha plano por metadata |
| Ressincronização | Reentrega de evento válido consulta estado atual, sem depender do redirect |
| Replay de Checkout já vinculado | Não substitui assinatura posterior; permite repetir sync que falhou |

As RPCs existentes recusam planos incompatíveis com as vagas. Por isso, não habilitar
troca irrestrita no Portal: um downgrade incompatível pode cobrar no Stripe e ser
recusado no banco. Um fluxo futuro de troca deve validar vagas antes de mudar o preço
e definir política de proração; o Portal auditado também encerraria o trial em trocas.

## Validação e limites

Testes sem rede para Stripe: adapters, actions, renderização React e execução dos
entrypoints reais em VM com mocks de Stripe/Supabase/Deno. Testes SQL executam as
migrations reais em PostgreSQL em memória, com fixtures da plataforma Supabase.
Não são um teste de pagamento externo em sandbox nem uma execução no runtime remoto.

Runtime de validação Node 24.19.0:

| Comando | Resultado |
| --- | --- |
| `npm test` | 126 testes aprovados; zero falhas/skips |
| `npm run lint` | Aprovado |
| `npm run typecheck` | Aprovado |
| `npm run build` | Aprovado; 30 páginas geradas |
| `git diff --check` | Aprovado |
| `deno check --node-modules-dir=none --no-lock` nos dois entrypoints | Aprovado |
| `node scripts/verify-stripe-recovery.mjs` | Aprovado; hashes históricos preservados |

## Antes de produção

1. Revisar e aplicar a migration nova, publicar ambas as Edge Functions e então
   publicar o frontend. Não executar a migration sem revisar o histórico remoto.
2. Executar aceitação em sandbox isolado: os seis checkouts, trial longo/curto,
   checkout cancelado/reaberto, Portal, renovação, falha/recuperação, cancelamento,
   reentregas e mudanças de preço compatíveis. A conexão Stripe disponível nesta
   sessão era somente live; nenhum checkout, assinatura ou cobrança real foi criado.
3. Confirmar permissões de leitura de assinaturas para a chave server-side usada pelo
   webhook (agora necessária para reconciliar), assinatura HMAC, URL de retorno de
   produção e monitoramento/reentrega de eventos 409. Não foram lidos valores do Vault.
4. Se pausa/retomada forem habilitadas, inscrever `customer.subscription.paused` e
   `customer.subscription.resumed`; os handlers estão preparados, mas esses eventos
   não estão inscritos no endpoint live auditado.
5. Continua a lacuna histórica `20260919201138_hardening_snapshot_owner_timezone`
   sem SQL remoto recuperável, documentada na recuperação anterior; não foi inventada
   migration para preenchê-la. Isso limita a afirmação de equivalência total de schema.

Referências: [Stripe trials](https://docs.stripe.com/payments/checkout/free-trials),
[Portal e webhooks](https://docs.stripe.com/customer-management/integrate-customer-portal),
[Supabase invoke](https://supabase.com/docs/reference/javascript/functions-invoke).
