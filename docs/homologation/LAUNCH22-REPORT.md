# Candidata para 22/10/2026

**Decisão atual: NO-GO para piloto e comercial.** A preparação de código e SQL avança; faltam operações produtivas autorizadas e recuperação comprovada. Nenhuma mudança produtiva foi executada nesta missão.

## Estado e correções

- Main `19d0074d0cf8d0d847e45f6545cc1eaa84721d23`; PRs #69, #70, #72, #73 e #74 integradas. PR #71 comercial continua aberta e foi preservada.
- Vercel produção READY `dpl_BrwH1RZya8jdh5FbgqRzxVzhtNCj`, SHA igual à main. A publicação decorreu dos merges anteriores, sem ação de deploy nesta missão.
- CI original da main: [falhou](https://github.com/plbr010/agende/actions/runs/39549448246), com 420 PASS e dois FAIL no harness de transporte. A função `bookingJourneySteps`, adicionada por #73, estava ausente do mock de #74. Corrigido usando o módulo real de validação, sem modificar regras de reserva.
- E2E revelou expectativa antiga de texto de cidades visível: #73 passou esse texto para `details`. O teste agora abre a seção antes de conferir o texto e a validação da cidade. Antes: 12 PASS/1 FAIL; depois: 13 PASS.
- Readback de cleanup antes assumia conta nova com exatamente duas reservas. A reexecução na mesma conta preserva duas reservas anteriores canceladas: o harness agora permite declarar explicitamente esse histórico esperado, mantendo o padrão zero e exigindo duas reservas atuais, todas canceladas, IDs únicos e nenhuma linha extra. A primeira asserção FAIL foi preservada; nenhuma reserva foi apagada para ajustar contagem.
- Branch própria `codex/launch-operation-20261022`, com deploy automático desabilitado antes de push. Nenhuma sobrescrita do Cursor, alteração de dependências, nova migration ou mudança de produto.

## Testes desta rodada

| Verificação | Resultado | Evidência/limite |
|---|---|---|
| Unitários, contratos e integração | PASS: 422, zero FAIL/skip | `launch22-standard-tests.json`; 255 unit/static, 66 PGlite com Auth simulado, 16 Stripe mocks, 85 platform mocks |
| PostgreSQL 17 nativo, conjunto focado | PASS: 17 | `launch22-native-tests.json`; 7 SQL incluindo upgrade 3+5 e retry, 10 concorrência. Cluster isolado encerrado; não é restore de produção |
| Lint | PASS | Zero erros, dois warnings preexistentes de `source` nos geradores de bundles |
| Typecheck | PASS | Next typegen + tsc |
| Build e smoke local | PASS | Build com placeholders de CI; smoke não escreve no backend |
| E2E isolado | PASS: 13 | `launch22-isolated-e2e.json`; backend sintético. Primeira tentativa sem Chromium foi BLOCKED; executado com Edge instalado. Falha intermediária de texto está preservada em `launch22-isolated-before.json` |
| Build com staging | PASS | URL/chave pública de staging incorporadas ao bundle; nenhuma credencial server-side exposta |
| Jornada E2E real de staging | PASS: 12 grupos | `launch22-integrated-journey.json`; cliente previamente confirmado por SMTP, login/draft, reserva, double-click/reload/Back, WhatsApp interceptado, reagendamento e cancelamento reais, avatar e discovery com #73/#74 |
| Auth E2E de staging | PASS: 5 grupos | `launch22-auth-edges.json`; telefone, campos preservados, conta existente, token real já usado e sessão malformada. Não houve novo envio SMTP nesta rodada |
| Cleanup de staging | PASS: 3 grupos | `launch22-cleanup-readback.json`; duas reservas atuais e duas históricas canceladas, serviços novos arquivados, horários novos ausentes e settings restaurados |
| Stripe TEST: leitura atual do provedor | PASS | `launch22-stripe-provider-audit.json`; seis checkouts mensal/anual de Solo/Equipe5/Equipe15 pagos, invoices/subscriptions reconciliadas e endpoint TEST configurado; zero mutações no provedor |
| Recuperação completa de produção | BLOCKED | SHA-256/tamanho conferidos; restauração e Storage não comprovados |
| Operações SQL/Auth/SMTP/Edge produtivas | BLOCKED | Não autorizadas; preparação disponível |
| Aceite financeiro LIVE | BLOCKED | Não houve cobrança, replay financeiro ou entrega positiva LIVE nesta rodada |

Não somar cobertura nativa/PGlite como cenários únicos. Instalação limpa e auditoria de dependências são verificadas na CI da PR, que deve estar verde no SHA aprovado. Não declarar uma execução histórica TEST como nova transação.

## Banco, oito migrations e segurança

Leitura atual em ambos os projetos: nenhuma tabela de app/public sem RLS. Produção permanece com 67 entradas de migrations, nenhuma das oito planejadas por nome; staging tem 22 entradas de provisionamento, não comparáveis só por versão/contagem. `launch22-catalog.json` registra histórico e buckets.

`launch22-security-gates.json` confirma produção com EXECUTE anônimo na wrapper de reserva, sem gate estrito de conta confirmada/sem guest fallback e sem tabela de reviews. Staging passa os gates de reserva e possui reviews. Não foi criada reserva produtiva para comprovar o risco: catálogo e fonte bastam para manter NO-GO.

Os oito arquivos e os dois bundles foram regenerados offline; hashes continuam idênticos aos manifests revisados. Ordem: três legadas antes das cinco principais. Reviews inclui readmodel de reagendamento; billing inclui reconciliação com excesso de assentos. A quinta principal usa REINDEX não concorrente. Detalhes de dependência, ACL/RLS, timeout, locks e pós-condições constam do [plano](../production-readiness/LAUNCH22-PLAN.md). Zero SQL aplicado. Não executar owner guard equivalente, db push ou repair para igualar históricos.

As evidências ADV20 de conta confirmada, ausência de fallback, isolamento, dados privados, fotos, permissões, WhatsApp manual e assinaturas continuam sendo a base de homologação. Os checks locais e cloud desta rodada verificam a combinação integrada de #73/#74; testes cloud não representam produção.

## Auth, backup e Stripe

Auth produtivo precisa de Site URL `https://agendeapp.online`, redirects `/auth/callback` e `/auth/recovery`, SMTP com domínio/remetente verificados e confirmação de e-mail obrigatória. Último painel observado tinha localhost, allowlist vazia e SMTP custom desabilitado; configuração administrativa não foi reinspecionada nesta rodada. Não marcar como resolvido sem conferir e testar entrega real autorizada. O plano fornece valores e testes exatos, sem inventar credenciais.

Backups privados de 16/10: oito componentes criptografados conferidos (quatro por arquivo), tamanho e hash válidos. `launch22-backup.json` registra `restore_verified=false` e `full_platform_restore_verified=false`. Manifest autenticado/descriptografia não revalidados; bytes Storage e cópia em outro domínio de falha não demonstrados; writes posteriores não cobertos. RPO/RTO não comprovados. A1 é bloqueante e nenhuma restauração foi executada.

Stripe TEST: auditoria atual de leitura PASS. Replay/idempotência, trial, portal, cancelamento, falha e entitlement têm evidências ADV20/FINAL anteriores e testes locais atuais; não foram cobrados novamente. LIVE permanece com roteiro de aceitação pendente. A última auditoria produtiva encontrou webhook Edge anterior sem guards de modo/logging corrigidos na main: revalidar e publicar fonte revisada exige autorização explícita e independente do deploy Next. Não alterar secrets. Endpoint ativo e ausência de falhas não comprovam entrega positiva LIVE.

## Plano e autorizações

O [LAUNCH22-PLAN](../production-readiness/LAUNCH22-PLAN.md) substitui a numeração histórica por **A1 backup/recuperação; A2 Auth/SMTP; A3 três legadas e pausa; A4 cinco principais; A5 segurança e publicação explícita da Edge; A6 SHA/deploy; A7 smoke sintético; A8 reservas/piloto; A9 faturamento/comercial**. Cada autorização tem alvo, efeitos e gates separados. Aprovar A1 não autoriza SQL, deploy ou restauração produtiva.

Com reservas pausadas, A7 não finge sucesso na reserva positiva; essa validação ocorre de forma controlada em A8 antes do aceite do piloto. Em falha, manter pausa e preferir fix-forward; não restaurar guest/anon nem desfazer RLS. Rollback frontend não reverte banco, Auth ou Stripe.

Para lançar em 22/10: concluir recuperação comprovada e SMTP antes da janela SQL; só então A3→A4→A5, SHA/CI aprovado em A6, A7 e A8. Comercial somente após A9. Sem esses gates, adiar abertura. O prazo não altera a decisão NO-GO.
