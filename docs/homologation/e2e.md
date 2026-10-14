# Testes de navegador — reprodução

Os runners **não acessam produção** (`agendeapp.online`, `agende-lac.vercel.app`, backend `wohimauqgywshbbejjcl`). Evidências vão para `artifacts/e2e/` (ignorado pelo Git) ou para `AGENDE_E2E_EVIDENCE`.

## Isolado (CI e desenvolvimento)

Sobe o build local com Supabase sintético. **Não submete** cadastro, login, reserva nem cobrança. Resultados desta suíte são **PASS LOCAL**, nunca PASS E2E.

```bash
npm ci
npx playwright install chromium
npm run build
npm run test:e2e
```

Opcionais:

| Variável | Efeito |
| --- | --- |
| `AGENDE_E2E_PORT` | Porta fixa em `127.0.0.1`. Sem ela, o runner escolhe uma porta livre. |
| `AGENDE_E2E_EVIDENCE` | Pasta de screenshots e `summary.json`. |

Códigos de saída: `0` ok · `1` FAIL de teste · `2` Playwright/navegador ausente · `3` servidor/`next start` ausente.

Reproduzível em CI: o workflow instala Chromium e roda `npm run test:e2e` depois do build.

## Staging (opt-in, nunca produção)

Sem ambiente autorizado a suíte **não navega** e marca todas as jornadas **BLOQUEADO** (saída 0). Não inventa PASS E2E.

```bash
export AGENDE_STAGING_ACCEPTANCE=fkpdudnnperufnmdwdlv
export AGENDE_STAGING_ORIGIN=http://127.0.0.1:3000
# opcional, somente fixtures de staging:
export AGENDE_STAGING_PRO_EMAIL=...
export AGENDE_STAGING_PRO_PASSWORD=...
export AGENDE_STAGING_CLIENT_EMAIL=...
export AGENDE_STAGING_CLIENT_PASSWORD=...
export AGENDE_STAGING_SALON_SLUG=...
# só então permitir writes sintéticos (ainda nunca LIVE):
# export AGENDE_STAGING_ALLOW_MUTATIONS=1
npm run test:e2e:staging
```

`AGENDE_STAGING_ORIGIN` precisa ser loopback ou hostname com `staging`. Qualquer URL de produção falha na hora.

Checkout só é seguido até um host `checkout.stripe.com` / `billing.stripe.com`. Cartão LIVE e `cs_live_` são recusados. Sem `AGENDE_STAGING_ALLOW_MUTATIONS=1` a suíte não cria conta, reserva nem sessão de cobrança.

## Matriz

A classificação oficial está em `src/lib/usability/homologation-matrix.ts`. Cadastro, agenda, financeiro e assinatura **não** são plenamente funcionais só porque os testes locais passaram.

Contrato do que o frontend espera do Codex: [docs/codex/frontend-backend-contract.md](../codex/frontend-backend-contract.md).
