# Operação de lançamento — 22/10/2026

Este documento define as autorizações **A1–A9 desta operação**. Os IDs A1–A12 do runbook PRELAUNCH20 são históricos e não equivalem aos IDs abaixo. Os arquivos SQL revisados daquele runbook continuam sendo os artefatos técnicos; nenhuma autorização foi concedida nesta missão. Produção: `wohimauqgywshbbejjcl`; staging: `fkpdudnnperufnmdwdlv`.

Main e deployment produtivo observados em 21/10: `19d0074d0cf8d0d847e45f6545cc1eaa84721d23`, Vercel READY `dpl_BrwH1RZya8jdh5FbgqRzxVzhtNCj`. A CI desse SHA falhou em dois mocks de reserva após #73. A correção da candidata importa o módulo real de validação no harness, preservando a implementação de #73/#74. Não há mudança de regra de produto.

## Autorizações independentes

| Etapa | Escopo concreto a autorizar | Gate de saída |
|---|---|---|
| A1 | Novo backup privado criptografado de banco/roles/histórico/configuração e metadata + bytes Storage; cópia em domínio de falha independente. Autorizar explicitamente também o ensaio de restauração **em destino isolado identificado**, sem restaurar produção. | Manifest autenticado, todos os arquivos descriptografáveis, catálogo/dados/roles/sequências/objetos conferidos no destino; registrar RPO/RTO. Sem isso, parar. Nenhuma contratação paga implícita. |
| A2 | Ajustar somente Auth/SMTP produtivos conforme os valores abaixo; credenciais por canal seguro, sem repositório/log. | Signup, confirmação e recovery da conta sintética autorizada entregues pelo SMTP, callbacks e sessão válidos. Envio de teste exige endereço próprio aprovado. |
| A3 | Suspender novas reservas públicas **e internas**, drenar requisições, conferir inventário estável e atualizar backup final de A1; aplicar somente o bundle das três legadas e seu histórico exato. | Backup final verificável, transação concluída, histórico +3, dados preservados, reservas continuam pausadas. A pausa e atualização do backup fazem parte explícita desta autorização. |
| A4 | Aplicar somente o bundle das cinco principais e seu histórico exato. | Histórico +5, sem fallback guest; buckets/RLS/ACLs/índice/readmodel corretos; reservas continuam pausadas. |
| A5 | Executar catálogo pós-SQL e negativos autorizados de segurança; publicar **separadamente e explicitamente** o código revisado da Edge `stripe-webhook`, preservando secrets, assinatura obrigatória e `verify_jwt=false`. | Fonte da Edge verificada, negativos 400 sem delta financeiro, ACLs e identidade confirmada corretos. A publicação da Edge precisa estar expressa: deploy da aplicação Next não a atualiza. |
| A6 | Merge/deploy do SHA exato aprovado, após CI verde, no projeto/domínio identificados. Se o código necessário já estiver publicado, registrar que não há deploy adicional obrigatório. | Deployment READY, alias e SHA correspondentes; não deduzir autorização de merge a partir de A3/A4. |
| A7 | Smoke produtivo somente nas contas/workspaces sintéticos nominados: Auth/SMTP, navegação, leitura, negativos, mídia e isolamento. Sem cobrança, WhatsApp automático ou dados de clientes reais. | Resultados PASS/FAIL/BLOCKED e cleanup limitado a recursos novos autorizado. Com reservas pausadas, a reserva positiva fica BLOCKED até A8; não abrir grants silenciosamente para passar o teste. |
| A8 | Restaurar EXECUTE **somente authenticated** das duas wrappers autorizadas, executar imediatamente reserva/reagendamento/cancelamento sintéticos e liberar piloto limitado após PASS. | Conta não confirmada/anônimo negados; uma reserva sob concorrência; operação interna autorizada preservada; observar logs/erros. Sem gate, manter ou retornar à pausa explicitamente autorizada. |
| A9 | Validar faturamento LIVE por roteiro e conta sintética aprovados, com limite monetário/eventos/efeitos explícitos em autorização própria; então liberar comercial. | Checkout mensal/anual, assinatura, webhook positivo, idempotência, portal/cancelamento e entitlement aprovados. Nenhuma cobrança é autorizada por este documento. |

Para cada autorização registrar projeto, operador, janela, SHA/hash, ações e limites. Aprovar uma linha não aprova outra. Não pedir nem registrar senhas em mensagens públicas.

## Auth/SMTP: configuração proposta

- Site URL: `https://agendeapp.online`.
- Redirects: `https://agendeapp.online/auth/callback` e `https://agendeapp.online/auth/recovery`. Validar também o callback com query `next` gerado pela aplicação; se o provedor exigir padrão adicional, restringi-lo a esse caminho, sem wildcard de domínio/preview. Remover localhost da produção após conferência. Não alterar staging.
- Confirmação de e-mail obrigatória; provider e-mail habilitado; anonymous sign-in desabilitado.
- SMTP: host/porta/TLS, usuário e secret do provedor aprovado; remetente do domínio verificado, SPF/DKIM/DMARC e limites compatíveis. Não inventar host/credencial nem considerar SMTP padrão pronto para lançamento. Host/remetente/provedor ainda dependem de acesso/configuração aprovada.
- Templates devem usar os links de confirmação do Supabase e preservar PKCE/redirect. Testar uma única utilização, expiração, reenviar, recovery, logout, refresh e sessão em navegador móvel. Cookies existentes são geridos pelo cliente SSR; não editar cookies manualmente em produção.

Última inspeção administrativa anterior: Site URL localhost, redirects vazios, SMTP custom desabilitado. Esses valores **não foram reinspecionados no painel nesta rodada**; A2 deve conferir o estado imediatamente antes de salvar. O código canônico e os dois caminhos foram reconferidos.

## Oito migrations: ordem e execução

Legadas A3, em ordem: `20260927014947_launch_readiness_reviews.sql` → `20261008131859_launch_hardening_reviews_force_rls.sql` → `20261009173042_billing_reconcile_excess_seats.sql`.

Principais A4, em ordem: `20261015054116_workspace_media_and_settings_contract.sql` → `20261015054818_workspace_settings_validation.sql` → `20261016075244_profiles_booking_whatsapp.sql` → `20261016235000_require_confirmed_public_booking.sql` → `20261020162935_launch_discovery_eligibility.sql`.

Fontes e hashes são os de `prelaunch20-legacy-manifest.json` e `prelaunch20-migration-manifest.json`, regenerados offline nesta rodada. Bundles SHA-256 respectivamente `89c60bad3dfac048ac962dda2f9cf8bc3e75fac58791296d85d5a520f6010bc8` e `06fbff8c01f37211019aa0b29276b87065930173d27fee21925363d4a904be6b` (UTF-8 LF). Qualquer diferença exige nova revisão/aprovação.

Produção ainda tem 67 entradas de histórico e nenhuma das oito por nome. Staging tem 22 entradas de provisionamento, com nomes das cinco e timestamps diferentes: comparar contrato físico, não falsificar histórico para igualar contagens. Owner guard antigo já fisicamente equivalente permanece excluído; não executar repair.

Revisão técnica detalhada: `prelaunch20-migrations.md` e `prelaunch20-legacy-audit.md`. Reviews legada inclui slots/readmodel necessários a reagendamento; billing corrige bloqueio indevido de eventos terminais com excesso de assentos. As principais adicionam mídia/settings, validam contrato, fotos/WhatsApp, fecham guest e reindexam discovery. DDL e REINDEX não concorrente podem bloquear writes: janela com reservas pausadas, lock timeout 5s e statement timeout 120s; falha deve abortar, sem remover guard.

Conectar somente após conferir projeto/host/certificado via TLS `verify-full`; GUC de intenção não prova identidade do servidor. Executar cada bundle com `psql -X`, `ON_ERROR_STOP=1`, `--single-transaction`, sem senha em argumento. São **duas transações**: se A4 falhar, A3 permanece aplicada. Não repetir bundles, não usar db push/repair indiscriminados. Ambos terminam pausados.

## Backup e rollback

Dois arquivos de 16/10 passaram novamente em tamanho e SHA-256 de quatro componentes cada. Isso verifica ciphertext contra manifest local; não autentica manifest, não prova descriptografia/restauração nem cópia independente. `restore_verified=false` e `full_platform_restore_verified=false`; bytes Storage não demonstrados. Backup antigo não cobre writes desde então. A1 permanece bloqueante.

Antes do commit SQL, erro/timeout reverte somente a transação atual. Depois, preferir fix-forward com reservas fechadas; rollback Next não desfaz banco, Auth ou Edge. Não voltar à função guest nem restaurar permissões anon. O destino anterior de frontend/Edge deve ser identificado e revisado antes de qualquer rollback autorizado; versão antiga insegura não serve como destino automático. Restauração **produtiva** permanece proibida e exigiria nova autorização de desastre com snapshot e perda esperada definidos.

## Stripe e decisão

Reutilizar evidência TEST ADV20 de seis planos/ciclos pagos e reconciliados, 12 replays idempotentes e negativos de webhook; lifecycle anterior comprova portal/cancelamento TEST. Esta rodada não cria nova cobrança. As datas e limites estão em `../homologation/ADV20-REPORT.md`; evidência TEST não equivale a aceite LIVE.

Última auditoria da Edge produtiva detectou fonte anterior sem guards de modo e com logging inseguro de erro SDK. Conferir/publicar fonte em A5 é independente do deploy Vercel; não alterar secrets/endpoint. Roteiro LIVE A9 precisa de entrega positiva real observada e conferência de assinatura, estado atual, duplicata e entitlement. Não simular PASS com chave configurada ou endpoint ativo.

GO para a janela exige CI/build/E2E da candidata, recuperação comprovada, A2 funcional, oito migrations corretas, Edge revisada e gates A5–A7. GO piloto exige A8 aprovado e smoke positivo. GO comercial exige também A9. Na ausência desses gates: **NO-GO piloto e comercial**. Horário alvo em 22/10 não substitui nenhum gate; se A1 ou A2 não fechar, adiar abertura.
