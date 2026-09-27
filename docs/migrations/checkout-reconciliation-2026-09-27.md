# Reconciliação do PR #12 — 27/09/2026 UTC (26/09 em São Paulo)

PR: https://github.com/plbr010/agende/pull/12
Base: main; branch: codex/stripe-checkout-live.
HEAD conferido antes das alterações: 392622bbea28c4c060d36b929fb71dbb9c07d4e7.
Projeto Supabase: wohimauqgywshbbejjcl.

Primeiro foram consultados, somente para leitura, o PR, o histórico em
supabase_migrations.schema_migrations e os arquivos das duas Edge Functions.
Nenhuma comparação usou SQL reconstituído ou normalização de whitespace.

- O único statement remoto de 20260927005815_stripe_checkout_guards corresponde
  exatamente ao conteúdo UTF-8 de 20260927002649_stripe_checkout_guards.sql.
- SHA-256 de ambos: 9b35bc4047883abd6a82f7884b191493454b7410d7584a1976a51c601b8a115a.
- Só depois da comparação o arquivo foi renomeado. O SQL não mudou.
- Todos os 63 registros remotos foram comparados com o inventário reconciliado.
  O snapshot atual está em remote-inventory-2026-09-27.json; snapshots antigos
  continuam históricos, sem reescrever o estado observado nas sessões anteriores.
- Resultado: 62 arquivos locais, 63 entradas remotas, local-only = [],
  remote-only = [20260919201138_hardening_snapshot_owner_timezone.sql].
- A entrada histórica continua com zero statements remotos. Nenhum placeholder
  foi criado e nada foi executado para reparar essa lacuna.

As funções stripe-billing e stripe-webhook estavam ACTIVE v2, com igualdade
exata de todos os arquivos retornados pelo Supabase. Os hashes de fonte e
verify_jwt estão em edge-v2-2026-09-27.json. Esses hashes são dos arquivos,
não os hashes ezbr do pacote de deployment.

O verificador exige o novo timestamp, ausência de local-only, a lacuna única
e igualdade dos entrypoints atuais com v2. Também mantém a conferência das
fontes v1 no commit histórico de main. CI faz fetch do histórico para isso.

Não houve db push, migration repair, nova migration, deploy de função ou
mutação de dados remotos nesta reconciliação. Os testes SQL rodam exclusivamente
em PGlite local; isso não prova equivalência total do schema remoto na lacuna.
