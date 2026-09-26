# Reconciliação da migration de trial

O histórico de `wohimauqgywshbbejjcl` foi consultado somente por SELECT em
`supabase_migrations.schema_migrations`. A migration aplicada é
`20260926194038_trial_selected_plan`, com um statement registrado.

O SQL local anterior era funcionalmente idêntico ao remoto. A comparação
exata confirmou somente dois comentários locais adicionais (sobre serialização
de elegibilidade e o lock de billing), CRLF em vez de LF e newline final.
O arquivo foi renomeado e essas diferenças textuais foram removidas, sem
alteração de instruções SQL. Os bytes UTF-8 agora correspondem exatamente ao
statement remoto, inclusive a ausência de newline final.

SHA-256 local e remoto:
`3fb3c3cf7322e96ca9cef8c7de83d63dc0485cd237b228e5eef8e49b685268d4`.

O inventário foi atualizado com a entrada de trial. As outras 61 entradas
de versão/nome foram comparadas com o histórico atual e permaneceram iguais.
Resultado: 61 migrations no Git, 62 no Supabase, nenhuma local-only e somente
`20260919201138_hardening_snapshot_owner_timezone` remote-only.
Nenhum placeholder foi criado para essa migration histórica.

O verificador agora exige essas contagens, rejeita qualquer local-only e
confere o hash exato da migration de trial, além dos arquivos Stripe já
verificados. Esse verificador usa o snapshot versionado, sem acessar o remoto.

Esta reconciliação não executou db push, migration repair, alterações no
Supabase ou merge. A ausência da migration histórica no Git permanece um
bloqueador para sincronização integral do histórico.

Validação local com Node 24: `node scripts/verify-stripe-recovery.mjs`,
`npm test` (111 aprovados), `npm run lint`, `npm run typecheck`,
`npm run build` (30/30 páginas) e `git diff --check` aprovados.
