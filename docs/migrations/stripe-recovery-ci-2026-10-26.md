# Correção cirúrgica do verificador Stripe

Base consultada: main `ab479b5f39441e4beeb1ce54315326fb9adaf2c7` (merge de #89).
Falha reproduzida localmente: `AssertionError: 85 !== 75`, linha 33 de
`scripts/verify-stripe-recovery.mjs`. Mesma falha do [job 121494378669](https://github.com/plbr010/agende/actions/runs/40299733114/job/121494378669).

## Causa e fonte da expectativa

- **85**: quantidade de arquivos `.sql` em `supabase/migrations` na main atual.
- **75**: quantidade local esperada antes de #84/#86/#88/#89: 63 migrations no
  snapshot remoto histórico de 27/09, menos a única migration sem fonte local,
  mais 13 arquivos locais explicitamente revisados (`63 - 1 + 13 = 75`).
- Dez arquivos novos: sete de #84, um de #86, um de #88 e um de #89.
  Nenhuma migration anterior foi removida. A lista extra também precisava ser
  atualizada; trocar apenas o número não resolveria a verificação seguinte.

A fonte aprovada é `docs/production-readiness/launch-final-migration-plan.json`
**no commit imutável `b6ce86c7e9717839d60c57bfe371e3d8d5915082`**, integrado por #89.
Seus 11 arquivos incluem um guard histórico já listado entre os 13 anteriores;
a união tem 23 nomes. O total deriva de `63 - 1 + 23 = 85`, sem usar a contagem
encontrada no diretório para definir a expectativa. O manifesto atual não é
regenerado nem usado para aceitar arquivos novos automaticamente.

## Integridade preservada

Mantidos: snapshot remoto com 63 registros; única ausência histórica
`20260919201138_hardening_snapshot_owner_timezone.sql`; lista extra exata;
hashes e statement counts do SQL Stripe recuperado, trial e Checkout;
hashes de código recuperado e Edge Functions nos SHAs históricos originais.
Nenhum snapshot, hash ou arquivo SQL/Edge foi alterado.

Adicionada conferência SHA256 dos 11 arquivos do manifesto aprovado, usando
normalização LF somente onde o próprio manifesto declara `sha256_lf`.
Os hashes históricos continuam comparando bytes exatos. Git history completo
é necessário, como já era para as verificações históricas; o CI usa fetch-depth 0.

## Evidências

- Verificador corrigido: PASS, local 85/remoto histórico 63, uma ausência e
  23 arquivos extras revisados.
- Sete testes de regressão + 16 testes Stripe Edge: **23 passaram**, zero
  falhas/skips. Os negativos rejeitam arquivo não revisado mesmo com manifesto
  atual adulterado, remoção de migration, placeholder da ausência histórica,
  SQL Stripe modificado, nova migration modificada e hash Edge histórico alterado.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilidades.
- Lint: zero erros, dois warnings preexistentes nos scripts de preparação.
- `audit-schema-drift.mjs`: exit 0; é diagnóstico de diferenças contra snapshot
  antigo, não afirmação de equivalência com produção atual.
- `audit-local-flows.mjs`: falha preexistente na suíte agenda. O cenário
  `receptionist cannot write other workspace` espera `not_workspace_member`,
  mas a RPC nega com `not_authorized (42501)`. O script, loader e todas as fontes
  SQL dessa execução são idênticos à main (diff vazio). Não foi relaxado nem
  alterado esse teste neste PR. O CI completo pode continuar vermelho nessa
  etapa posterior; a falha do verificador Stripe é independente.

Reproduzir: `node scripts/verify-stripe-recovery.mjs` e
`node --import tsx --test scripts/verify-stripe-recovery.test.mjs scripts/stripe-edge.test.mjs`.
Os novos testes estão incluídos em `npm test`.

Nenhuma operação Stripe LIVE, migration remota, deploy produtivo, alteração de
retenção, reativação de reservas ou merge foi executado por esta correção.
