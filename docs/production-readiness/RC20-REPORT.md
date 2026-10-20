# Agendê — release candidate, 20/10/2026

**NO-GO para lançamento produtivo.** Candidata de aplicação validada; a janela operacional ainda não foi autorizada nem executada. Zero migrations, mudanças de configuração, deploys, cobranças, exclusões ou restaurações produtivas nesta missão.

## 1. Pronto e estado real

Base da candidata e aplicação efetivamente publicada: **`9a8625ae2182e06716f47de3bc8da9051f898e3a`**. Main CI [39482608819](https://github.com/plbr010/agende/actions/runs/39482608819) aprovado. Vercel `dpl_84raZVv15LKrLDMDu8D6ZPtRSXqW`, READY, domínio `agendeapp.online`, confirmado novamente por API. A missão não fez esse merge/deploy.

#66/#67/#68/#69/#70 integradas. #70 foi integrada em 20/10 às 19:20:22 UTC; o diagnóstico de banco anterior continua válido. Comparação da árvore de aplicação não encontrou código de produto novo depois de #69. #71, `cursor/comercial-agende-0a70`, permanece aberta e preservada; não foi integrada por esta missão. Branch própria `codex/release-candidate-20261020`, criada da main limpa, com deploy Git desativado antes do push. O SHA exato do pacote final de evidências é o head da PR, registrado na entrega e na descrição da PR; o SHA de aplicação acima é imutável e foi efetivamente testado.

## 2. Falta para lançar

1. Backup recente recuperável de banco/roles/Auth e bytes Storage, cópia independente, ensaio isolado autorizado e RPO/RTO medidos.
2. Janela com suspensão de reservas, três contratos legados e depois as cinco migrations, mantendo a reserva pausada até autorização de retomada.
3. Site URL/redirects produtivos corretos e SMTP próprio configurado e homologado.
4. Publicação específica do `stripe-webhook` revisado e verificação do contrato LIVE sem cobrança real implícita.
5. Postchecks e 17 smoke tests produtivos autorizados, com observabilidade e critérios de contenção.

## 3. Corrigido/preparado nesta candidata

Nenhuma correção funcional adicional foi necessária: não foi reproduzida regressão no código atual. Não alterar código para esconder incompatibilidade do banco. Adicionado executor `scripts/rc20-staging-readonly.mjs`: sessões reais de fixtures existentes, GoTrue/PostgREST/Next/Edge, sem gravação de negócio. Adicionada proteção de deploy para a branch. Evidências novas usam prefixo `rc20-`; os relatórios históricos foram preservados. SQL histórico e fontes do Cursor intactos. Contratos reais em [RC20-CONTRACTS.md](RC20-CONTRACTS.md).

## 4. Testes

| Resultado | Execução nesta missão | Evidência/limite |
|---|---|---|
| PASS | `npm ci`, Node 24, 407 pacotes | Instalação limpa pelo lockfile; lockfile sem alteração |
| PASS | `npm audit --omit=dev --audit-level=high` | Zero vulnerabilidades de dependências produtivas; não equivale a auditoria universal |
| PASS | Lint, typecheck, build staging e smoke do build | Build Next 16.3.8 com URL staging explicitamente conferida |
| PASS | 412 testes padrão, zero falhas/skips | [rc20-standard-tests.json](rc20-standard-tests.json): 253 unit/static, 62 PGlite com Auth simulado, 16 Stripe mocks, 81 platform mocks |
| PASS | 71 testes PostgreSQL 17.6 nativo | [rc20-native-tests.json](rc20-native-tests.json): 11 integração com Auth simulado, 50 SQL, 10 concorrência; cluster local encerrado |
| PASS | Upgrade 3+5, replay recusado, dados preexistentes preservados, pausa/retomada | Incluído nos 412 e nos 71, não somar como casos exclusivos adicionais; modelo sintético do catálogo observado, sem restore |
| PASS | Concorrência real em conexões PG17 | [rc20-concurrency.json](rc20-concurrency.json): slot único, rollback, reagendamento, avaliação única, último dono, equipe, mídia e billing conforme casos da suíte |
| PASS | 11 E2E isolados Edge | [rc20-isolated-e2e.json](rc20-isolated-e2e.json); backend sintético, não prova cloud |
| PASS | 5 grupos de aceitação staging atual | [rc20-staging-e2e.json](rc20-staging-e2e.json): três identidades confirmadas, anon RPC 42501, histórico preservado, equipe/agenda/cliente mobile sem overflow, busca em duas cidades |
| PASS | Bundles regenerados sem diferenças | Geradores offline; nenhuma conexão de aplicação SQL |
| PASS | Verificadores de contratos Stripe e drift histórico | Estes scripts usam snapshots antigos; não substituem o catálogo atual `rc20-*` |
| PASS | HTTPS produtivo somente GET | [rc20-production-http.json](rc20-production-http.json), incluindo amostra de assets e avatar sem sessão; sem smoke autenticado |
| FAIL | Gates de readiness da produção | Schema/ACL de reserva, Auth, recuperação e webhook impedem GO; não são falhas das suítes locais |
| BLOCKED | Aplicação SQL, alterações Auth/SMTP, publicação Edge/app e smoke de escrita produtivos | Exigem autorização específica; não executados |
| BLOCKED | Restore isolado e comprovação de recuperação | Usuário proibiu restauração nesta missão; hash de ciphertext não comprova restore |

Não houve falha de teste na execução final. Novos signup/SMTP/upload/reserva/reagendamento/cancelamento/checkout cloud não foram repetidos nesta missão; as provas completas FINAL20 anteriores continuam identificadas pelo SHA/data originais. A sessão de uma hora foi **PASS real** em `docs/homologation/final20-session-lifecycle.json`: expiração natural em 3600s, rejeição do token original, refresh preservando identidade e logout. Código de Auth não mudou desde essa prova; o teste de uma hora não foi repetido. Login/getUser/logout das três fixtures foram renovados nesta missão.

## 5. Segurança e riscos

| Fronteira | Código/staging | Produção observada |
|---|---|---|
| Conta e e-mail confirmado, sem guest | Guards da Server Action e SQL; SQL dinâmico e staging PASS | **P0: wrapper ainda concede EXECUTE a anon; corpo privado ainda permite `v_uid := NULL`**. Frontend não corrige chamada direta ao RPC |
| Duplicidade e isolamento | Exclusão/locks e 10 testes concorrentes; RLS/IDOR/roles cobertos | RLS ligada em todas as tabelas app/public inventariadas; não afirmar proteção do auth gate ausente |
| Dados de cliente/equipe | Vínculo legítimo e escopo de profissional; sem diretório global | RPC de avatar relacionado/WhatsApp ainda ausente; preservar negação, não adicionar fallback privilegiado |
| Imagens | Conta privada; foto profissional privada com leitura pública mediada; logo/capa públicos com consentimento | Bucket profissional e capa ainda ausentes; regras novas de mídia pendentes |
| Service role | `server-only`, identidade/tenant autorizados antes de acesso administrativo | Metadata Vercel confirma chave sensitive production-only; valor não lido/descriptografado |
| WhatsApp | GET autorizado → 302 `wa.me`; operador decide enviar | Sem envio automático e sem teste enviando mensagem nesta missão |
| Stripe | Assinatura, guards ambiente LIVE/TEST, idempotência, origem de preço e reconciliação revisadas | Webhook v4 ACTIVE diferente da main; guarda de modo e logs sanitizados ainda precisam publicação. Billing SQL antigo pode reter entitlement em transição terminal com excesso de assentos |

Inventário novo: produção 318 colunas, 243 funções app/public; staging 335 colunas, 258 funções. Staging tem 15 assinaturas ausentes na produção e 6 definições diferentes normalizadas; detalhes em [rc20-contract-diff.json](rc20-contract-diff.json), ACLs, RLS e colunas nos snapshots `rc20-*-schema-acl.json` / `rc20-*-function-acl.json`. Não interpretar contagens sozinhas como equivalência. Nenhuma tabela app/public sem RLS no snapshot produtivo. Histórico 67 entradas em produção versus 22 de provisionamento em staging; local 75. Diferenças por nome/objetos prevalecem sobre timestamps.

## 6. Migrations

Revisão individual de ordem, dependências, permissões, locks, compatibilidade e pós-condições permanece em [prelaunch20-migrations.md](prelaunch20-migrations.md), reconfirmada pelo catálogo novo e ensaio PG17:

| Ordem | Arquivo | Condição principal |
|---|---|---|
| 1 | `20261015054116_workspace_media_and_settings_contract.sql` | cover, fila, políticas restritivas, swaps; lock ALTER/constraints; fluxo novo de imagem substitui escrita direta |
| 2 | `20261015054818_workspace_settings_validation.sql` | Mesma assinatura, validação reafirmada intencionalmente; sem backfill |
| 3 | `20261016075244_profiles_booking_whatsapp.sql` | Bucket/foto/avatar/WhatsApp e primeira trava; não idempotente, versão intermediária ainda tem fallback |
| 4 | `20261016235000_require_confirmed_public_booking.sql` | Remove fallback; anon sem EXECUTE; aplicar junto da anterior, nunca liberar no intervalo |
| 5 | `20261020162935_launch_discovery_eligibility.sql` | Busca elegível, acentos/espaços, **REINDEX não concorrente bloqueia escrita**; janela/timeouts |

As cinco continuam ausentes em produção. Antes delas faltam fisicamente `20260927014947_launch_readiness_reviews.sql`, `20261008131859_launch_hardening_reviews_force_rls.sql` e `20261009173042_billing_reconcile_excess_seats.sql`: reviews, slots de reagendamento/IDs no read model e billing. `launch_observed_owner_guard` já é equivalente fisicamente e não deve ser reaplicada ou registrada ficticiamente. Revisão: [prelaunch20-legacy-audit.md](prelaunch20-legacy-audit.md).

Bundles/manifests existentes foram regenerados sem alteração: `prelaunch20-apply-legacy.sql` → `prelaunch20-apply-five.sql`, cada um em sua transação. Se o segundo falhar, o primeiro permanece aplicado. Preflight recusa replay/estado parcial; timeout de lock 5s e statement 120s; encerra reservas pausadas. Nenhum `db push`, `migration repair` ou SQL mutante remoto executado.

## 7. Produção

Aplicação READY não significa release operacional. Site URL `http://localhost:3000`, redirects vazios e SMTP customizado desligado foram reconfirmados no painel nesta missão. Staging usa localhost intencionalmente com callbacks/recovery localhost e 127.0.0.1 permitidos. Metadata de envs renovada sem decrypt em [rc20-env-metadata.json](rc20-env-metadata.json); origem pública fallback Vercel existe no código, mas não corrige GoTrue. Config de SMTP/Auth restante e endpoint Stripe ativo foram observados na auditoria anterior de hoje, não revalidados integralmente agora. Entrega LIVE positiva permanece não demonstrada; zero eventos observados não prova integração.

Bucket logo público e avatar privado presentes, bucket profissional ausente. Webhook produtivo v4/source divergente reconfirmado em [rc20-webhook.json](rc20-webhook.json). Backups cifrados de 16/10 continuam com tamanho/hash corretos, reconferidos em [rc20-backup.json](rc20-backup.json); restore e autenticação criptográfica não comprovados, bytes Storage não cobertos. Plano FREE e ausência de backup agendado/PITR pertencem à observação do painel anterior de hoje. Não houve restore, descriptografia, novo export ou leitura de dados privados de clientes.

## 8. PR e preservação

PR draft da branch desta candidata, URL/SHA exato fornecidos na entrega. Merge é operação produtiva: integração Git da main aciona Vercel. Não fazer merge para “apenas publicar o relatório”. Trabalho do Cursor e PR #71 preservados. Não houve comunicação enviada ao Cursor; [RC20-CONTRACTS.md](RC20-CONTRACTS.md) é o handoff revisável.

## 9. Plano de lançamento

Seguir [prelaunch20-runbook.md](prelaunch20-runbook.md) e os [17 smoke tests](prelaunch20-smoke.md), todos ainda NOT RUN em produção. Sequência: autorização por escopo e SHA/hash → backup banco/Auth/roles/Storage + cópia independente + recuperação isolada autorizada → pausa/drenagem + snapshot final → Auth/SMTP → bundle 3 legadas → bundle 5 → Edge webhook específico → postchecks → retomada somente authenticated autorizada → smoke/observação.

Antes: catálogo atualizado e hashes sem drift, acesso TLS verify-full, plano de contingência e recuperação comprovados. Depois: schema/RLS/ACL/índice/buckets e contratos por catálogo; anon/unconfirmed negados sem reserva, confirmado com slot disponível, uma reserva por concorrência, equipe/cliente/media/busca/WhatsApp manual sem envio, Stripe sem cobrança LIVE implícita.

Rollback: em falha, pausar novamente, drenar e manter dados; identificar deployment/fonte exatos antes de promover versão compatível ou fix-forward. Não reabrir anon, não reintroduzir fallback/log inseguro, não apagar colunas/tabelas para desfazer DDL. Banco aditivo permanece até decisão revisada. Restore produtivo é contingência separada de alto impacto, com ponto de recuperação e autorização próprios; nenhum restore automático. RPO/RTO ainda desconhecidos.

Autorizações necessárias propostas, sem solicitá-las para executar agora: A1 export cifrado banco+Storage/cópia; A2 restore isolado; A3 pausa; A4 Auth URLs; A5 SMTP; **A6b três legadas antes de A6 cinco**; A7 Edge webhook; A8 app/merge apenas se necessário; A9 retomada e fixtures/smoke produtivos; A10 HTTP negativo webhook; A11 contenção/rollback com destino exato; A12 restore produtivo somente em desastre e nova aprovação. Escopos completos e limites no runbook. Aprovar um item não autoriza os demais, upgrade pago ou cobrança real.

## 10. GO/NO-GO

**GO para revisão da candidata; NO-GO para lançamento.** GO produtivo exige todos os gates: recuperação demonstrada, schema/ACL alinhados, Auth/SMTP corrigidos, webhook revisado publicado, smoke produtivo autorizado aprovado e ausência de regressão/erro operacional. Qualquer gate pendente mantém NO-GO. A estimativa anterior de 90% técnico não representa autorização nem readiness produtiva; não converter testes locais em percentual de lançamento.
