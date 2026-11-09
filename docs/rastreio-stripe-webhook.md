# Rastreio (utmify-propria-base) + Stripe: o que falta configurar

## O que já está no código

- **Script:** `https://utmify-propria-base.vercel.app/t.js` é carregado no `<head>` (async) pelo componente `src/components/marketing/rastreio.tsx`. Ele só roda **em produção** (`VERCEL_ENV=production`) e só nas páginas públicas de marketing, as mesmas do Meta Pixel (`/`, `/profissionais`, `/descobrir`, `/cadastro`, `/login`, `/comecar`, `/termos`, `/privacidade`, `/verificar-email`, `/demo*`). Ele não roda em `/app` nem em URLs com token, porque o t.js envia a URL completa ao rastreador.
- **Visitante:** o t.js grava o id do visitante no cookie `_rv` (`rv_` + 16 hex) do próprio domínio.
- **Checkout:** ao abrir o checkout, a server action lê `_rv` e o cookie de primeiro toque `agende_acq` (UTMs) e envia esses dados à Edge Function `stripe-billing`. A função grava `vid`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` e `landing` no `metadata` da Checkout Session **e** da assinatura (`subscription_data.metadata`).
- **`client_reference_id` continua sendo o id do negócio (workspace).** O webhook do próprio Agendê (`stripe-webhook`) usa esse campo para ligar a assinatura ao salão, então ele não pode mudar. O Rastreio lê `metadata.vid` e `metadata.utm_*`, e também procura `rv_…` em qualquer parte do evento, então a atribuição funciona sem usar o `client_reference_id`.

## Passos manuais

### 1. Publicar a Edge Function alterada (Supabase de produção)

O deploy das funções é manual. Depois do merge:

```bash
supabase functions deploy stripe-billing --project-ref <ref-de-producao>
```

O `supabase/config.toml` já mantém `verify_jwt = true` para `stripe-billing`. Sem esse deploy o checkout funciona normalmente, mas não leva as UTMs.

### 2. Criar o webhook no Stripe (modo **Live**)

1. Stripe Dashboard → **Developers → Webhooks** (Workbench → Webhooks) → **Add destination / Add endpoint**.
2. **Events from:** *Your account*.
3. **Eventos** (selecione exatamente):
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `charge.refunded`
   - `charge.dispute.created`
4. **Destination type:** Webhook endpoint.
5. **Endpoint URL:** `https://utmify-propria-base.vercel.app/api/webhooks/stripe?token=SEU_TOKEN`. Use o token do Rastreio e não o coloque no repositório.
6. Salve. **Não altere nem apague** o endpoint que já existe para o Supabase (`.../functions/v1/stripe-webhook`). Os dois coexistem.
7. O Rastreio valida só o `?token=` (não usa o *signing secret* do Stripe). Mantenha o token secreto e troque-o se ele vazar.
8. Teste: na página do endpoint, use **Send test event** → `checkout.session.completed`. A resposta esperada é HTTP 200 com `{"ok":true,...}`. Um 403 indica token errado.

### 3. Conferir de ponta a ponta

1. Abra `https://agendeapp.online/?utm_source=FB&utm_campaign=Teste|1&utm_medium=Conj|2&utm_content=Ad|3&utm_term=feed` em uma janela anônima. A visita deve aparecer no Rastreio.
2. Crie a conta e assine um plano.
3. No Stripe, abra a Checkout Session e confira em **Metadata** os campos `vid`, `utm_*`, `app=agende` e `workspace_id`.
4. Confira o pedido no Rastreio.

## Limitações do parser Stripe do Rastreio (repositório `utmify-propria-base`)

Estes problemas não são resolvidos neste repositório e afetam o que aparece como venda:

- **O teste grátis gera uma venda de R$ 0 "pendente".** Quem assina durante os 7 dias de teste fecha o checkout com `payment_status = no_payment_required` e `amount_total = 0`. O Rastreio registra isso como `pending` e R$ 0. A cobrança real acontece depois, em uma **invoice** (`invoice.paid`), e o Rastreio não trata esse evento hoje.
- **Reembolso e chargeback não se ligam ao pedido.** Em checkout de assinatura não existe `payment_intent` na sessão, então o pedido fica com o id `cs_…`. Já `charge.refunded` e `charge.dispute.created` usam o `payment_intent` da invoice, então o estorno não encontra o pedido.
- **Correção sugerida (no Rastreio):** tratar `invoice.paid`, `invoice.payment_failed` e `customer.subscription.deleted`. Use `parent.subscription_details.metadata` (ou `subscription_details.metadata`, conforme a versão da API), onde o Agendê já grava `vid` e `utm_*`. Use o id da assinatura ou do `payment_intent` da invoice como `externalId`. Quando isso existir, adicione esses eventos ao mesmo webhook.
